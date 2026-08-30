#!/usr/bin/env python3

import http.client
import json
import os
import tempfile
import threading
import unittest
from unittest.mock import Mock, call, patch
from pathlib import Path
from types import SimpleNamespace

from pidog_voice_server import RobotController, VoiceServer


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
        self.assertIn("sit", payload["commands"])

    def test_valid_command(self):
        status, payload = self.request(
            "POST", "/command", {"command": "sit", "phrase": "Пидог, сядь"}
        )
        self.assertEqual(202, status)
        self.assertEqual("sit", payload["command"])
        self.assertIn("message", payload)

    def test_color_search_is_listed(self):
        status, payload = self.request("GET", "/health")
        self.assertEqual(200, status)
        self.assertIn("find_orange", payload["commands"])
        self.assertIn("light_orange", payload["commands"])

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
             patch("pidog_voice_server.shutil.which", return_value="/usr/bin/play"), \
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
