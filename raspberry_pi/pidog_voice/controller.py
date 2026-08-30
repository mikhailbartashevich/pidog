"""High-level command registry and serialized robot access."""

from __future__ import annotations

import os
import subprocess
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Callable

from .audio import AudioMixin, _DeferredMusic
from .assistant import AssistantManager
from .constants import COMMAND_COLORS, LOG
from .sensors import SensorsMixin
from .vision import VisionMixin
from .voice import LocalVoiceListener


class RobotController(AudioMixin, VisionMixin, SensorsMixin):
    """Serializes hardware access and exposes an allow-list of robot commands."""

    def __init__(self, dry_run: bool = False) -> None:
        self._dry_run = dry_run
        self._lock = threading.RLock()
        self._dog: Any = None
        self._vilib: Any = None
        self._camera_started = False
        self._audio_ready = False
        self._audio_error: str | None = None
        self._sound_dir: Path | None = None
        self._audio_player: str | None = None
        self._audio_processes: list[subprocess.Popen[str]] = []
        self._audio_lock = threading.Lock()
        self._behavior_lock = threading.Lock()
        self._behavior_stop = threading.Event()
        self._behavior_thread: threading.Thread | None = None
        self._touch_stop = threading.Event()
        self._touch_thread: threading.Thread | None = None
        self._power_samples: deque[tuple[float, float]] = deque()
        self._external_power: bool | None = None
        self._assistant = AssistantManager(dry_run=dry_run)
        self._local_voice = LocalVoiceListener(
            self._execute_local_voice, conversation=self._execute_local_conversation)
        if not dry_run:
            # PiDog constructs pygame even though this service routes sounds
            # through SoX. The dummy driver avoids a silent 30-second ALSA open
            # during startup and prevents pygame from competing for the card.
            os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
            self._configure_pidog_user()
            import robot_hat

            # Pidog has no option to skip Music(). On Robot HAT 5 its pygame
            # constructor can block startup for ~30 seconds. Replace only the
            # imported audio class; preset actions are routed to SoX below.
            robot_hat.Music = _DeferredMusic
            from pidog import Pidog

            self._dog = Pidog()
            self._prepare_audio()

        self._actions: dict[str, Callable[[], dict[str, Any] | None]] = {
            "stop": self._stop,
            "forward": lambda: self._action("forward", 98),
            "backward": lambda: self._action("backward", 98),
            "turn_left": lambda: self._action("turn_left", 98),
            "turn_right": lambda: self._action("turn_right", 98),
            "drive_forward": lambda: self._continuous_motion("forward"),
            "drive_backward": lambda: self._continuous_motion("backward"),
            "drive_left": lambda: self._continuous_motion("turn_left"),
            "drive_right": lambda: self._continuous_motion("turn_right"),
            "approach_obstacle": self._approach_obstacle,
            "sit": lambda: self._action("sit", 65),
            "stand": lambda: self._action("stand", 65),
            "lie": lambda: self._action("lie", 65),
            "bark": self._bark,
            "wag_tail": lambda: self._action("wag_tail", 90),
            "shake_head": lambda: self._action("shake_head", 70),
            "nod_yes": self._nod,
            "stretch": lambda: self._action("stretch", 45),
            "push_up": lambda: self._action("push_up", 60),
            "handshake": self._handshake,
            "high_five": self._high_five,
            "howl": self._howl,
            "sleep": self._sleep_until_clap,
            "measure_distance": self._measure_distance,
            "listen_sound": self._listen_sound,
            "show_battery": self._show_battery,
            "local_voice_on": self._start_local_voice,
            "local_voice_off": self._stop_local_voice,
            "light_red": lambda: self._light_command("red"),
            "light_orange": lambda: self._light_command("#FF7A00"),
            "light_yellow": lambda: self._light_command("yellow"),
            "light_green": lambda: self._light_command("green"),
            "light_blue": lambda: self._light_command("blue"),
            "light_purple": lambda: self._light_command("#A020F0"),
            "light_pink": lambda: self._light_command("pink"),
            "light_cyan": lambda: self._light_command("cyan"),
            "light_white": lambda: self._light_command("white"),
            "light_blink": self._light_blink,
            "light_off": self._light_off,
            "find_orange": lambda: self._find_color("orange"),
            "find_red": lambda: self._find_color("red"),
            "find_yellow": lambda: self._find_color("yellow"),
            "find_green": lambda: self._find_color("green"),
            "find_blue": lambda: self._find_color("blue"),
            "find_purple": lambda: self._find_color("purple"),
            "follow_face": self._follow_face,
            "stop_face_follow": self._stop_face_follow,
            "follow_object": self._follow_object,
            "stop_object_follow": self._stop_object_follow,
            "camera_on": self._camera_on,
            "camera_off": self._camera_off,
        }
        if not dry_run:
            self._start_touch_monitor()

    @property
    def dry_run(self) -> bool:
        return self._dry_run

    @property
    def commands(self) -> tuple[str, ...]:
        return tuple(self._actions)

    @property
    def audio_status(self) -> dict[str, Any]:
        if self._dry_run:
            return {"ready": None, "message": "dry-run: аудио не проверялось"}
        result: dict[str, Any] = {
            "ready": self._audio_ready,
            "backend": "sox/alsa",
            "device": os.environ.get("PIDOG_ALSA_DEVICE", "robothat"),
        }
        if self._sound_dir is not None:
            result["sound_dir"] = str(self._sound_dir)
        if self._audio_error:
            result["error"] = self._audio_error
        return result

    @property
    def local_voice_status(self) -> dict[str, Any]:
        if self._dry_run:
            return {
                "active": None, "state": "dry-run",
                "language": os.environ.get("PIDOG_VOICE_LANGUAGE", "ru"),
                "input": "PiDog built-in microphone",
            }
        return self._local_voice.status

    @property
    def assistant_status(self) -> dict[str, Any]:
        return self._assistant.status

    def assistant_control(self, action: str) -> dict[str, Any]:
        return self._assistant.control(action)

    def assistant_chat(self, message: str, use_web: bool | None,
                       speak: bool = False) -> dict[str, Any]:
        result = self._assistant.chat(message, use_web=use_web)
        if speak:
            self._speak_text(result["answer"])
            result["spoken"] = True
        else:
            result["spoken"] = False
        return result

    def assistant_clear_history(self) -> dict[str, Any]:
        return self._assistant.clear_history()

    def execute(self, command: str) -> dict[str, Any]:
        action = self._actions.get(command)
        if action is None:
            raise ValueError(f"unknown command: {command}")
        with self._lock:
            LOG.info("command=%s dry_run=%s", command, self._dry_run)
            if self._dry_run:
                return {"message": f"Команда принята: {command}"}
            # Long-running modes use a single cooperative background worker.
            # Any new command takes control immediately and stops the old mode.
            if command not in {"stop_face_follow", "stop_object_follow"}:
                self._cancel_behavior()
            if command in COMMAND_COLORS:
                self._set_light("breath", COMMAND_COLORS[command], bps=1.2, brightness=0.8)
            result = action()
            return result or {"message": "Команда выполнена"}

    def close(self) -> None:
        self._stop_touch_monitor()
        self._local_voice.close()
        self._cancel_behavior()
        with self._lock:
            self._close_camera()
            try:
                if self._dog is not None:
                    self._dog.close()
                    self._dog = None
            finally:
                if not self._dry_run:
                    self._disable_speaker()

    def _action(self, name: str, speed: int) -> None:
        self._dog.do_action(name, speed=speed)

    def _continuous_motion(self, action_name: str) -> dict[str, Any]:
        self._start_behavior(
            f"joystick-{action_name}",
            lambda stop_event: self._continuous_motion_worker(action_name, stop_event),
        )
        return {"active": True, "message": "Непрерывное движение включено"}

    def _continuous_motion_worker(self, action_name: str,
                                  stop_event: threading.Event) -> None:
        self._dog.do_action("stand", speed=90)
        self._dog.wait_legs_done()
        # Fail-safe for a dropped phone connection: no joystick request may
        # leave the robot walking forever.
        deadline = time.monotonic() + 20
        while not stop_event.is_set() and time.monotonic() < deadline:
            self._dog.do_action(action_name, step_count=1, speed=100)
            self._dog.wait_legs_done()
        self._dog.body_stop()

    def _start_behavior(self, name: str,
                        target: Callable[[threading.Event], None]) -> None:
        self._cancel_behavior()
        stop_event = threading.Event()

        def run() -> None:
            try:
                target(stop_event)
            except Exception:
                LOG.exception("background behavior failed: %s", name)
                try:
                    self._dog.body_stop()
                except Exception:
                    LOG.debug("could not stop body after behavior error", exc_info=True)
            finally:
                with self._behavior_lock:
                    if self._behavior_thread is threading.current_thread():
                        self._behavior_thread = None

        thread = threading.Thread(
            target=run, name=f"pidog-{name}", daemon=True)
        with self._behavior_lock:
            self._behavior_stop = stop_event
            self._behavior_thread = thread
        thread.start()

    def _cancel_behavior(self) -> None:
        with self._behavior_lock:
            stop_event = self._behavior_stop
            thread = self._behavior_thread
            stop_event.set()
        if thread is not None and thread is not threading.current_thread():
            if thread.is_alive() and self._dog is not None:
                try:
                    self._dog.body_stop()
                except Exception:
                    LOG.debug("could not stop active behavior immediately", exc_info=True)
            thread.join(timeout=1.5)
        with self._behavior_lock:
            if self._behavior_thread is thread and (thread is None or not thread.is_alive()):
                self._behavior_thread = None

    def _execute_local_voice(self, command: str, phrase: str) -> None:
        try:
            self.execute(command)
        except Exception:
            LOG.exception("local voice command failed command=%s phrase=%r", command, phrase[:200])

    def _execute_local_conversation(self, phrase: str) -> None:
        try:
            result = self._assistant.chat(phrase, use_web=None)
            self._speak_text(result["answer"])
        except Exception:
            LOG.exception("local assistant conversation failed phrase=%r", phrase[:200])

    def _start_local_voice(self) -> dict[str, Any]:
        started = self._local_voice.start()
        return {
            "local_voice": self._local_voice.status,
            "message": (
                "Режим прослушивания включается: говорите во встроенный микрофон Пайдог"
                if started else "Пайдог уже принимает команды через встроенный микрофон"
            ),
        }

    def _stop_local_voice(self) -> dict[str, Any]:
        stopped = self._local_voice.stop()
        self._light_off()
        return {
            "local_voice": self._local_voice.status,
            "message": (
                "Прослушивание встроенного микрофона выключается"
                if stopped else "Прослушивание встроенного микрофона уже выключено"
            ),
        }

    def _stop(self) -> dict[str, Any]:
        self._cancel_behavior()
        self._dog.body_stop()
        self._light_off()
        return {"message": "Пайдог остановлен"}

    def _handshake(self) -> None:
        from pidog.preset_actions import hand_shake

        hand_shake(self._dog)

    def _high_five(self) -> None:
        from pidog.preset_actions import high_five

        high_five(self._dog)

    def _nod(self) -> None:
        from pidog.preset_actions import nod

        nod(self._dog)
