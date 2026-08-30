#!/usr/bin/env python3

import http.client
import json
import os
import re
import tempfile
import threading
import unittest
from unittest.mock import Mock, call, patch
from pathlib import Path
from types import SimpleNamespace

from pidog_voice_server import (
    LocalVoiceListener,
    RobotController,
    VoiceServer,
    match_local_voice_command,
)
from pidog_voice.assistant import AssistantManager


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.controller = RobotController(dry_run=True)
        cls.server = VoiceServer(("127.0.0.1", 0), cls.controller, "secret")
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.controller.close()
        cls.thread.join(timeout=2)

    def request(self, method: str, path: str, body=None, token="secret"):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        headers = {"X-PiDog-Token": token}
        if body is not None:
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        connection.close()
        return response.status, payload

    def test_health(self):
        status, payload = self.request("GET", "/health")
        self.assertEqual(200, status)
        self.assertTrue(payload["ok"])
        self.assertIsNone(payload["audio"]["ready"])
        self.assertEqual("dry-run", payload["local_voice"]["state"])
        self.assertIn("sit", payload["commands"])
        self.assertIn("local_voice_on", payload["commands"])
        self.assertIn("drive_forward", payload["commands"])
        self.assertTrue(payload["assistant"]["installed"])

    def test_assistant_status(self):
        status, payload = self.request("GET", "/assistant/status")
        self.assertEqual(200, status)
        self.assertTrue(payload["assistant"]["running"])
        self.assertEqual("dry-run", payload["assistant"]["state"])

    def test_assistant_chat(self):
        status, payload = self.request(
            "POST", "/assistant/chat",
            {"message": "Кто ты?", "search": False, "speak": False},
        )
        self.assertEqual(200, status)
        self.assertIn("Тестовый ответ", payload["answer"])
        self.assertFalse(payload["searched"])

    def test_assistant_control(self):
        status, payload = self.request(
            "POST", "/assistant/control", {"action": "start"})
        self.assertEqual(200, status)
        self.assertIn("assistant", payload)

    def test_assistant_rejects_oversized_question(self):
        status, payload = self.request(
            "POST", "/assistant/chat", {"message": "x" * 601})
        self.assertEqual(400, status)
        self.assertFalse(payload["ok"])

    def test_valid_command(self):
        status, payload = self.request(
            "POST", "/command", {"command": "sit", "phrase": "Пайдог, сядь"}
        )
        self.assertEqual(202, status)
        self.assertEqual("sit", payload["command"])
        self.assertIn("message", payload)

    def test_color_search_is_listed(self):
        status, payload = self.request("GET", "/health")
        self.assertEqual(200, status)
        self.assertIn("find_orange", payload["commands"])
        self.assertIn("light_orange", payload["commands"])
        self.assertIn("follow_face", payload["commands"])
        self.assertIn("approach_obstacle", payload["commands"])

    def test_server_accepts_every_android_command(self):
        robot_command_source = (
            Path(__file__).resolve().parent.parent
            / "app/src/main/java/ru/pidog/voice/RobotCommand.java"
        ).read_text(encoding="utf-8")
        android_commands = set(re.findall(
            r'^\s*[A-Z][A-Z0-9_]*\("([a-z0-9_]+)"',
            robot_command_source,
            flags=re.MULTILINE,
        ))
        android_commands.update({
            "drive_forward", "drive_backward", "drive_left", "drive_right",
        })

        self.assertTrue(android_commands, "Android command registry is empty")
        missing_commands = android_commands.difference(self.controller.commands)
        self.assertEqual(
            set(), missing_commands,
            f"Server does not accept Android commands: {sorted(missing_commands)}",
        )

    def test_sensor_snapshot(self):
        status, payload = self.request("GET", "/sensors")
        self.assertEqual(200, status)
        self.assertEqual(42.0, payload["distance_cm"])
        self.assertEqual(60, payload["battery_percent"])
        self.assertFalse(payload["external_power"])
        self.assertFalse(payload["charging"])

    def test_rejects_unknown_command(self):
        status, payload = self.request("POST", "/command", {"command": "dance"})
        self.assertEqual(400, status)
        self.assertFalse(payload["ok"])

    def test_requires_token(self):
        status, _ = self.request("GET", "/health", token="wrong")
        self.assertEqual(401, status)


class AudioConfigurationTest(unittest.TestCase):
    def test_audio_setup_leaves_speaker_disabled(self):
        controller = object.__new__(RobotController)
        controller._dog = SimpleNamespace()

        with patch.object(controller, "_find_sound_dir",
                          return_value=Path("/tmp/pidog-sounds")), \
             patch("pidog_voice.audio.shutil.which", return_value="/usr/bin/play"), \
             patch.object(controller, "_disable_speaker") as disable:
            controller._prepare_audio()

        self.assertTrue(controller._audio_ready)
        self.assertEqual("/usr/bin/play", controller._audio_player)
        disable.assert_called_once_with()

    def test_speaker_is_enabled_only_while_audio_is_playing(self):
        controller = object.__new__(RobotController)
        original_speak = Mock()
        controller._dog = SimpleNamespace(speak=original_speak)
        controller._audio_processes = []
        events = []

        with patch.object(controller, "_enable_speaker",
                          side_effect=lambda: events.append("on")), \
             patch.object(controller, "_disable_speaker",
                          side_effect=lambda: events.append("off")), \
             patch.object(controller, "_speak_via_alsa",
                          side_effect=lambda *_: events.append("play")), \
             patch.object(controller, "_wait_for_audio_processes",
                          side_effect=lambda: events.append("wait")):
            controller._play_with_speaker(
                lambda: controller._dog.speak("single_bark_1", 100))

        self.assertEqual(["on", "play", "wait", "off"], events)
        self.assertIs(original_speak, controller._dog.speak)

    def test_speaker_is_disabled_when_audio_action_fails(self):
        controller = object.__new__(RobotController)
        controller._dog = SimpleNamespace()
        controller._audio_processes = []

        with patch.object(controller, "_enable_speaker"), \
             patch.object(controller, "_disable_speaker") as disable:
            with self.assertRaisesRegex(RuntimeError, "playback failed"):
                controller._play_with_speaker(
                    lambda: (_ for _ in ()).throw(RuntimeError("playback failed")))

        disable.assert_called_once_with()

    def test_audio_status_reports_sox_alsa_backend(self):
        controller = object.__new__(RobotController)
        controller._dry_run = False
        controller._audio_ready = True
        controller._audio_error = None
        controller._sound_dir = Path("/tmp/pidog-sounds")
        controller._dog = SimpleNamespace()

        status = controller.audio_status

        self.assertTrue(status["ready"])
        self.assertEqual("sox/alsa", status["backend"])
        self.assertEqual("robothat", status["device"])

    def test_configured_sound_directory_overrides_root_default(self):
        with tempfile.TemporaryDirectory() as temporary_dir:
            sound_dir = Path(temporary_dir)
            (sound_dir / "single_bark_1.wav").touch()
            (sound_dir / "howling.mp3").touch()
            controller = object.__new__(RobotController)
            controller._dog = SimpleNamespace(SOUND_DIR="/root/pidog/sounds/")
            previous = os.environ.get("PIDOG_SOUND_DIR")
            os.environ["PIDOG_SOUND_DIR"] = temporary_dir
            try:
                self.assertEqual(sound_dir.resolve(), controller._find_sound_dir())
            finally:
                if previous is None:
                    os.environ.pop("PIDOG_SOUND_DIR", None)
                else:
                    os.environ["PIDOG_SOUND_DIR"] = previous

    def test_required_sound_file_accepts_wav_or_mp3(self):
        with tempfile.TemporaryDirectory() as temporary_dir:
            sound_dir = Path(temporary_dir)
            self.assertFalse(RobotController._has_sound(sound_dir, "howling"))
            (sound_dir / "howling.wav").touch()
            self.assertTrue(RobotController._has_sound(sound_dir, "howling"))


class HeadTouchReactionTest(unittest.TestCase):
    def setUp(self):
        self.controller = object.__new__(RobotController)
        self.controller._lock = threading.RLock()
        self.controller._behavior_lock = threading.Lock()
        self.controller._behavior_thread = None
        self.controller._touch_stop = threading.Event()
        self.controller._set_light = Mock()

    def test_happy_reaction_moves_head_tail_and_lights(self):
        self.controller._dog = SimpleNamespace(
            head_move=Mock(),
            do_action=Mock(),
        )

        self.controller._happy_head_touch()

        head_angles = self.controller._dog.head_move.call_args.args[0]
        self.assertEqual(20, len(head_angles))
        self.controller._dog.head_move.assert_called_once_with(
            head_angles, immediately=False, speed=80)
        self.controller._dog.do_action.assert_called_once_with(
            "wag_tail", step_count=10, speed=80)
        self.controller._set_light.assert_called_once_with(
            "listen", "#8A2BE2", bps=0.35, brightness=0.8)

    def test_touch_is_debounced_and_rearmed_after_release(self):
        readings = iter(("L", "L", "R", "N", "RS", "N"))
        self.controller._dog = SimpleNamespace(
            dual_touch=SimpleNamespace(read=lambda: next(readings)))
        self.controller._happy_head_touch = Mock()

        class FiniteStopEvent:
            def __init__(self):
                self.waits = 0

            def wait(self, _timeout):
                self.waits += 1
                return self.waits > 6

            @staticmethod
            def is_set():
                return False

        self.controller._touch_stop = FiniteStopEvent()

        self.controller._watch_head_touch()

        self.assertEqual(2, self.controller._happy_head_touch.call_count)


class LocalVoiceControlTest(unittest.TestCase):
    def test_matches_safe_local_voice_commands(self):
        self.assertEqual("local_voice_on", match_local_voice_command(
            "Пайдог, пожалуйста, перейди в режим слушать!"))
        self.assertEqual("sit", match_local_voice_command("Пайдог, сядь"))
        self.assertEqual("local_voice_off", match_local_voice_command("перестань слушать"))
        self.assertIsNone(match_local_voice_command("похожи немного вперед"))

    def test_matches_new_requested_local_phrases(self):
        self.assertEqual("find_red", match_local_voice_command("найти красный цвет"))
        self.assertEqual("high_five", match_local_voice_command("дай мне пять"))
        self.assertEqual("wag_tail", match_local_voice_command("повиляй хвостом"))
        self.assertEqual("stretch", match_local_voice_command("сделай потягушки"))
        self.assertEqual("measure_distance", match_local_voice_command(
            "расстояние до предмета"))
        self.assertEqual("follow_face", match_local_voice_command("следи за лицом"))
        self.assertEqual("follow_object", match_local_voice_command("следи за предметом"))
        self.assertEqual("stop_object_follow", match_local_voice_command(
            "останови слежение за предметом"))
        self.assertEqual("approach_obstacle", match_local_voice_command(
            "иди вперед до препятствия"))

    def test_listener_executes_commands_and_can_stop_by_voice(self):
        results = iter(("сядь", {"final": "перестань слушать"}))
        received = []
        completed = threading.Event()

        class Recognizer:
            def listen(self, stream=False):
                self.assert_stream = stream
                return next(results)

        listener = None

        def execute(command, phrase):
            received.append((command, phrase))
            if command == "local_voice_off":
                listener.stop()
                completed.set()

        listener = LocalVoiceListener(execute, Recognizer)
        self.assertTrue(listener.start())
        self.assertTrue(completed.wait(2))
        listener.close()

        self.assertEqual(["sit", "local_voice_off"], [item[0] for item in received])
        self.assertEqual("off", listener.status["state"])

    def test_listener_reports_recognizer_startup_error(self):
        failed = threading.Event()

        def fail():
            failed.set()
            raise RuntimeError("Vosk model unavailable")

        listener = LocalVoiceListener(lambda *_: None, fail)
        listener.start()
        self.assertTrue(failed.wait(2))
        listener.close()

        self.assertEqual("error", listener.status["state"])
        self.assertIn("Vosk model unavailable", listener.status["error"])

    def test_listener_accepts_json_text_returned_by_vosk(self):
        self.assertEqual("сядь", LocalVoiceListener._extract_phrase('{"text": "сядь"}'))

    def test_listener_routes_unknown_phrase_to_assistant(self):
        received = []
        completed = threading.Event()

        class Recognizer:
            def listen(self, stream=False):
                return "какая сегодня погода"

        listener = None

        def conversation(phrase):
            received.append(phrase)
            listener.stop()
            completed.set()

        listener = LocalVoiceListener(lambda *_: None, Recognizer, conversation)
        listener.start()
        self.assertTrue(completed.wait(2))
        listener.close()
        self.assertEqual(["какая сегодня погода"], received)


class VisionCompatibilityTest(unittest.TestCase):
    def setUp(self):
        self.controller = object.__new__(RobotController)

    def test_uses_current_vilib_face_switch(self):
        current_switch = Mock()
        self.controller._vilib = SimpleNamespace(
            face_detect_switch=current_switch,
            human_detect_switch=Mock(),
        )

        self.controller._set_face_detection(True)

        current_switch.assert_called_once_with(True)
        self.controller._vilib.human_detect_switch.assert_not_called()

    def test_falls_back_to_legacy_vilib_human_switch(self):
        legacy_switch = Mock()
        self.controller._vilib = SimpleNamespace(human_detect_switch=legacy_switch)

        self.controller._set_face_detection(False)

        legacy_switch.assert_called_once_with(False)

    def test_face_tracking_uses_actual_camera_center(self):
        self.controller._vilib = SimpleNamespace(camera_width=640, camera_height=480)

        self.assertEqual((320.0, 240.0), self.controller._camera_center())

    def test_yunet_parameters_select_largest_face(self):
        faces = [
            [10, 20, 30, 40, 0, 0, 0, 0, 0, 0, 0.8],
            [100, 120, 80, 60, 0, 0, 0, 0, 0, 0, 0.7],
        ]

        parameters = self.controller._face_parameters(faces)

        self.assertEqual(2, parameters["human_n"])
        self.assertEqual(140, parameters["human_x"])
        self.assertEqual(150, parameters["human_y"])
        self.assertEqual(80, parameters["human_w"])
        self.assertEqual(60, parameters["human_h"])

    def test_yunet_parameters_report_no_face(self):
        self.assertEqual({"human_n": 0}, self.controller._face_parameters(None))

    def test_lost_face_barks_once(self):
        self.controller._vilib = SimpleNamespace(camera_width=640, camera_height=480)
        self.controller._dog = SimpleNamespace(head_move=Mock())
        self.controller._clamp = lambda value, minimum, maximum: max(
            minimum, min(maximum, value))
        self.controller._bark_once = Mock()
        self.controller._detect_face_yunet = Mock(side_effect=[
            {"human_n": 1, "human_x": 320, "human_y": 240},
            {"human_n": 0},
            {"human_n": 0},
        ])
        stop_event = SimpleNamespace(wait=Mock(side_effect=[False, False, False, True]))

        with patch("pidog_voice.vision.time.monotonic", side_effect=[0.0, 2.1]):
            self.controller._follow_face_worker(stop_event, detector=object())

        self.controller._bark_once.assert_called_once_with(yaw=0.0, pitch=0.0)

    def test_center_object_tracking_box_uses_middle_of_frame(self):
        frame = SimpleNamespace(shape=(480, 640, 3))

        box = self.controller._center_tracking_box(frame)

        self.assertEqual((236, 156, 168, 168), box)


class AssistantRoutingTest(unittest.TestCase):
    def test_fresh_information_uses_web(self):
        self.assertTrue(AssistantManager._needs_web("Какая погода сегодня?"))
        self.assertTrue(AssistantManager._needs_web("Find the latest news"))
        self.assertFalse(AssistantManager._needs_web("Расскажи сказку про собаку"))


class PowerStatusTest(unittest.TestCase):
    def test_reads_configured_external_power_status(self):
        with tempfile.TemporaryDirectory() as temporary_dir:
            power_dir = Path(temporary_dir)
            online = power_dir / "online"
            online.write_text("1\n", encoding="utf-8")
            (power_dir / "status").write_text("Charging\n", encoding="utf-8")
            previous = os.environ.get("PIDOG_EXTERNAL_POWER_PATH")
            os.environ["PIDOG_EXTERNAL_POWER_PATH"] = str(online)
            try:
                self.assertEqual((True, True), RobotController._read_power_supply())
            finally:
                if previous is None:
                    os.environ.pop("PIDOG_EXTERNAL_POWER_PATH", None)
                else:
                    os.environ["PIDOG_EXTERNAL_POWER_PATH"] = previous


if __name__ == "__main__":
    unittest.main()
