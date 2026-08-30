#!/usr/bin/env python3
"""LAN HTTP bridge between the PiDog Android remote and SunFounder PiDog V2."""

from __future__ import annotations

import argparse
import hmac
import json
import logging
import os
import pwd
import re
import shutil
import signal
import subprocess
import threading
import time
import unicodedata
from collections import deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable


LOG = logging.getLogger("pidog-voice")
MAX_BODY_BYTES = 8 * 1024
AUDIO_FILES = ("single_bark_1", "howling")
SERVER_VERSION = "1.2.0"

COMMAND_COLORS = {
    "stop": "#FF3030", "forward": "#21D07A", "backward": "#00B8D9",
    "turn_left": "#7C4DFF", "turn_right": "#FF4FA3", "sit": "#FFD54F",
    "stand": "#4DD0E1", "lie": "#8D6E63", "bark": "#FF6D00",
    "wag_tail": "#FF80AB", "shake_head": "#9575CD", "nod_yes": "#66BB6A",
    "stretch": "#26A69A", "push_up": "#EF5350", "handshake": "#42A5F5",
    "high_five": "#FFCA28", "howl": "#5C6BC0", "sleep": "#3949AB",
    "measure_distance": "#26C6DA", "listen_sound": "#AB47BC",
    "show_battery": "#66BB6A",
    "local_voice_on": "#00D9FF", "local_voice_off": "#78909C",
    "find_orange": "#FF7A00", "find_red": "#FF2020", "find_yellow": "#FFE000",
    "find_green": "#20D060", "find_blue": "#2080FF", "find_purple": "#A020F0",
}

VOICE_FILLERS = {
    "пайдог", "пес", "песик", "собака", "собачка", "робот",
    "эй", "ну", "давай", "пожалуйста", "команда", "теперь", "быстро",
}

# Local recognition deliberately uses an exact allow-list after punctuation and
# filler words are removed. A doubtful phrase must never move the robot.
LOCAL_VOICE_ALIASES: dict[str, tuple[str, ...]] = {
    "stop": ("стоп", "стой", "остановись", "замри", "не двигайся", "прекрати", "хватит"),
    "forward": ("вперед", "иди вперед", "двигайся вперед", "шагай вперед", "иди прямо"),
    "backward": ("назад", "иди назад", "двигайся назад", "шагай назад", "сдай назад"),
    "turn_left": ("налево", "влево", "поверни налево", "поверни влево"),
    "turn_right": ("направо", "вправо", "поверни направо", "поверни вправо"),
    "sit": ("сидеть", "сесть", "сядь", "садись", "присядь"),
    "stand": ("встать", "встань", "поднимись", "на ноги"),
    "lie": ("лежать", "лечь", "ляг", "ложись", "приляг"),
    "bark": ("голос", "подай голос", "гав", "гавкни", "залай"),
    "wag_tail": ("хвост", "виляй хвостом", "помаши хвостом", "махай хвостом"),
    "shake_head": ("покачай головой", "потряси головой", "качай головой"),
    "nod_yes": ("кивни", "скажи да", "покажи да"),
    "stretch": ("потянись", "растяжка", "сделай растяжку"),
    "push_up": ("отжимайся", "отожмись", "сделай отжимание", "сделай отжимания"),
    "handshake": ("дай лапу", "лапу", "пожми руку"),
    "high_five": ("дай пять", "пять", "ладушки"),
    "howl": ("вой", "завой", "выть", "повой"),
    "sleep": ("спать", "засыпай", "усни", "дремать", "отдыхай"),
    "measure_distance": ("измерь расстояние", "какое расстояние", "дистанция", "что впереди"),
    "listen_sound": ("слушай звук", "найди звук", "откуда звук", "слушай хлопок"),
    "show_battery": ("покажи заряд", "сколько заряда", "заряд батареи", "покажи батарею"),
    "find_orange": ("найди оранжевый", "покажи оранжевый", "найди оранжевую баночку"),
    "find_red": ("найди красный", "покажи красный"),
    "find_yellow": ("найди желтый", "покажи желтый"),
    "find_green": ("найди зеленый", "покажи зеленый"),
    "find_blue": ("найди синий", "покажи синий"),
    "find_purple": ("найди фиолетовый", "покажи фиолетовый"),
    "camera_on": ("включи камеру", "запусти камеру", "покажи камеру"),
    "camera_off": ("выключи камеру", "останови камеру", "закрой камеру"),
    "light_red": ("красный свет", "включи красный", "свети красным"),
    "light_orange": ("оранжевый свет", "включи оранжевый", "свети оранжевым"),
    "light_yellow": ("желтый свет", "включи желтый", "свети желтым"),
    "light_green": ("зеленый свет", "включи зеленый", "свети зеленым"),
    "light_blue": ("синий свет", "включи синий", "свети синим"),
    "light_purple": ("фиолетовый свет", "включи фиолетовый", "свети фиолетовым"),
    "light_pink": ("розовый свет", "включи розовый", "свети розовым"),
    "light_cyan": ("голубой свет", "включи голубой", "свети голубым"),
    "light_white": ("белый свет", "включи белый", "свети белым"),
    "light_blink": ("мигай светом", "моргай светом", "мигай лампочками"),
    "light_off": ("выключи свет", "погаси свет", "свет выключить"),
    "local_voice_on": (
        "слушай меня", "слушай команды", "включи голосовое управление",
        "перейди в режим слушать", "принимай команды с микрофона",
    ),
    "local_voice_off": (
        "перестань слушать", "хватит слушать", "выключи голосовое управление",
        "отключи голосовое управление", "принимай команды с телефона",
    ),
}


def normalize_voice_phrase(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower().replace("ё", "е")
    normalized = re.sub(r"[^a-zа-я0-9]+", " ", normalized).strip()
    return " ".join(word for word in normalized.split() if word not in VOICE_FILLERS)


def match_local_voice_command(phrase: str) -> str | None:
    candidate = normalize_voice_phrase(phrase)
    if not candidate:
        return None
    for command, aliases in LOCAL_VOICE_ALIASES.items():
        if candidate in aliases:
            return command
    return None


class LocalVoiceListener:
    """Runs PiDog's offline Vosk recognizer without blocking the HTTP server."""

    def __init__(self, execute: Callable[[str, str], None],
                 recognizer_factory: Callable[[], Any] | None = None) -> None:
        self._execute = execute
        self._recognizer_factory = recognizer_factory or self._create_recognizer
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._state = "off"
        self._error: str | None = None
        self._last_phrase: str | None = None
        self._last_command: str | None = None

    @staticmethod
    def _create_recognizer() -> Any:
        from pidog.stt import Vosk

        return Vosk(language=os.environ.get("PIDOG_VOICE_LANGUAGE", "ru"))

    @property
    def status(self) -> dict[str, Any]:
        with self._lock:
            result: dict[str, Any] = {
                "active": self._state in {"starting", "listening", "stopping"},
                "state": self._state,
                "language": os.environ.get("PIDOG_VOICE_LANGUAGE", "ru"),
                "input": "PiDog built-in microphone",
            }
            if self._error:
                result["error"] = self._error
            if self._last_phrase:
                result["last_phrase"] = self._last_phrase
            if self._last_command:
                result["last_command"] = self._last_command
            return result

    def start(self) -> bool:
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return False
            self._stop_event.clear()
            self._state = "starting"
            self._error = None
            self._thread = threading.Thread(
                target=self._run, name="pidog-local-voice", daemon=True)
            self._thread.start()
            return True

    def stop(self) -> bool:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._state = "off"
                return False
            self._stop_event.set()
            self._state = "stopping"
            return True

    def close(self) -> None:
        self.stop()
        thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=2)

    def _run(self) -> None:
        try:
            recognizer = self._recognizer_factory()
            with self._lock:
                self._state = "listening"
            LOG.info("local voice control is listening through the PiDog microphone")
            while not self._stop_event.is_set():
                result = recognizer.listen(stream=False)
                # An HTTP stop or service shutdown may arrive while Vosk is
                # blocked waiting for speech. Discard that last utterance.
                if self._stop_event.is_set():
                    break
                phrase = self._extract_phrase(result)
                if not phrase:
                    continue
                command = match_local_voice_command(phrase)
                with self._lock:
                    self._last_phrase = phrase[:200]
                    self._last_command = command
                if command is None:
                    LOG.info("local_voice_phrase=%r command=unmatched", phrase[:200])
                    continue
                LOG.info("local_voice_phrase=%r command=%s", phrase[:200], command)
                self._execute(command, phrase)
        except Exception as error:
            LOG.exception("local voice control failed")
            with self._lock:
                self._error = str(error) or error.__class__.__name__
                self._state = "error"
            return
        finally:
            with self._lock:
                if self._state != "error":
                    self._state = "off"
            LOG.info("local voice control stopped")

    @staticmethod
    def _extract_phrase(result: Any) -> str:
        if isinstance(result, str):
            value = result.strip()
            if value.startswith("{"):
                try:
                    return LocalVoiceListener._extract_phrase(json.loads(value))
                except json.JSONDecodeError:
                    pass
            return value
        if isinstance(result, dict):
            for key in ("final", "text", "result"):
                value = result.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return ""


class AudioUnavailableError(RuntimeError):
    """Raised when PiDog cannot play one of its bundled sound effects."""


class _DeferredMusic:
    """Placeholder for PiDog's unused pygame player; SoX handles all audio."""


class RobotController:
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
        self._power_samples: deque[tuple[float, float]] = deque()
        self._external_power: bool | None = None
        self._local_voice = LocalVoiceListener(self._execute_local_voice)
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
            "forward": lambda: self._action("forward", 80),
            "backward": lambda: self._action("backward", 80),
            "turn_left": lambda: self._action("turn_left", 80),
            "turn_right": lambda: self._action("turn_right", 80),
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
            "sleep": lambda: self._action("doze_off", 65),
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
            "camera_on": self._camera_on,
            "camera_off": self._camera_off,
        }

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

    def execute(self, command: str) -> dict[str, Any]:
        action = self._actions.get(command)
        if action is None:
            raise ValueError(f"unknown command: {command}")
        with self._lock:
            LOG.info("command=%s dry_run=%s", command, self._dry_run)
            if self._dry_run:
                return {"message": f"Команда принята: {command}"}
            if command in COMMAND_COLORS:
                self._set_light("breath", COMMAND_COLORS[command], bps=1.2, brightness=0.8)
            result = action()
            return result or {"message": "Команда выполнена"}

    def sensors(self) -> dict[str, Any]:
        with self._lock:
            if self._dry_run:
                return {
                    "distance_cm": 42.0, "touch": "N", "sound_detected": False,
                    "sound_direction": None, "camera": self._camera_started,
                    "battery_voltage": 7.6, "battery_percent": 60,
                    "external_power": False, "charging": False,
                    "power_detection": "dry-run",
                }
            result: dict[str, Any] = {"camera": self._camera_started}
            voltage = self._safe_sensor(lambda: float(self._dog.get_battery_voltage()))
            result["battery_voltage"] = round(voltage, 2) if voltage is not None else None
            result["battery_percent"] = self._battery_percent(voltage) if voltage is not None else None
            result.update(self._power_status(voltage))
            result["distance_cm"] = self._safe_sensor(
                lambda: round(float(self._dog.read_distance()), 1))
            result["touch"] = self._safe_sensor(lambda: str(self._dog.dual_touch.read()))
            detected = self._safe_sensor(lambda: bool(self._dog.ears.isdetected()))
            result["sound_detected"] = detected if isinstance(detected, bool) else False
            result["sound_direction"] = (
                self._safe_sensor(lambda: int(self._dog.ears.read())) if detected is True else None
            )
            result["acceleration"] = self._serializable_sensor(lambda: self._dog.accData)
            result["gyroscope"] = self._serializable_sensor(lambda: self._dog.gyroData)
            return result

    def _power_status(self, voltage: float | None) -> dict[str, Any]:
        """Report external power without confusing a full battery with charging."""
        sysfs_status = self._read_power_supply()
        if sysfs_status is not None:
            external, charging = sysfs_status
            self._external_power = external
            return {
                "external_power": external,
                "charging": charging,
                "power_detection": "power_supply",
            }

        if voltage is None:
            return {
                "external_power": self._external_power,
                "charging": None,
                "power_detection": "unavailable",
            }

        now = time.monotonic()
        self._power_samples.append((now, voltage))
        while self._power_samples and self._power_samples[0][0] < now - 180:
            self._power_samples.popleft()

        reference = next(
            (sample for sample in self._power_samples if now - sample[0] >= 20), None)
        charging: bool | None = None
        detection = "voltage_wait"
        if reference is not None:
            delta = voltage - reference[1]
            detection = "voltage_trend"
            if delta >= 0.02:
                self._external_power = True
                charging = True
            elif delta <= -0.02:
                self._external_power = False
                charging = False
            elif self._external_power is False:
                charging = False

        return {
            "external_power": self._external_power,
            "charging": charging,
            "power_detection": detection,
        }

    @staticmethod
    def _read_power_supply() -> tuple[bool, bool | None] | None:
        configured = os.environ.get("PIDOG_EXTERNAL_POWER_PATH")
        online_paths: list[Path] = []
        if configured:
            online_paths.append(Path(configured).expanduser())
        power_root = Path("/sys/class/power_supply")
        if power_root.is_dir():
            online_paths.extend(sorted(power_root.glob("*/online")))

        for online_path in online_paths:
            if not configured or online_path != Path(configured).expanduser():
                try:
                    supply_type = (online_path.parent / "type").read_text(
                        encoding="utf-8").strip().lower()
                except OSError:
                    continue
                if supply_type not in {"mains", "usb", "usb_c", "usb_pd", "wireless"}:
                    continue
            try:
                value = online_path.read_text(encoding="utf-8").strip().lower()
            except OSError:
                continue
            if value not in {"0", "1", "false", "true", "off", "on"}:
                continue
            external = value in {"1", "true", "on"}
            charging: bool | None = None
            try:
                status = (online_path.parent / "status").read_text(
                    encoding="utf-8").strip().lower()
                if status:
                    charging = status == "charging"
            except OSError:
                pass
            return external, charging
        return None

    def close(self) -> None:
        self._local_voice.close()
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

    def _execute_local_voice(self, command: str, phrase: str) -> None:
        try:
            self.execute(command)
        except Exception:
            LOG.exception("local voice command failed command=%s phrase=%r", command, phrase[:200])

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
        self._dog.body_stop()
        self._light_off()
        return {"message": "Пайдог остановлен"}

    def _bark(self) -> None:
        self._require_audio()
        from pidog.preset_actions import bark

        self._play_with_speaker(lambda: bark(self._dog, volume=100))

    def _howl(self) -> dict[str, Any]:
        self._require_audio()
        from pidog.preset_actions import howling

        self._play_with_speaker(lambda: howling(self._dog, volume=100))
        return {"message": "Пайдог воет"}

    def _prepare_audio(self) -> None:
        """Prepare PiDog's sound path under systemd and leave the amp muted.

        Upstream PiDog derives SOUND_DIR from LOGNAME/SUDO_USER. A system unit
        runs as root, so it incorrectly uses /root/pidog/sounds even when the
        official repository (and its sound files) belongs to a user in /home.
        PiDog's pygame backend may initialize without errors but remain silent
        under systemd. The working Robot HAT path is SoX -> ALSA `robothat`.
        """
        self._audio_ready = False
        self._audio_error = None
        self._sound_dir = None
        try:
            sound_dir = self._find_sound_dir()
            if sound_dir is None:
                raise AudioUnavailableError(
                    "не найдены single_bark_1 и howling; задайте PIDOG_SOUND_DIR"
                )

            self._audio_player = shutil.which("play")
            if self._audio_player is None:
                raise AudioUnavailableError("не найден SoX play; установите пакет sox")

            self._dog.SOUND_DIR = f"{sound_dir}{os.sep}"
            self._sound_dir = sound_dir
            self._audio_ready = True
            LOG.info("PiDog audio ready sound_dir=%s backend=sox device=%s", sound_dir,
                     os.environ.get("PIDOG_ALSA_DEVICE", "robothat"))
        except Exception as error:
            self._audio_error = str(error) or error.__class__.__name__
            LOG.error("PiDog audio is unavailable: %s", self._audio_error)
        finally:
            self._disable_speaker()

    @staticmethod
    def _enable_speaker() -> None:
        # device.enable_speaker is the current robot-hat API; utils is retained
        # as a fallback for older images shipped with PiDog.
        try:
            from robot_hat.device import enable_speaker
        except ImportError:
            from robot_hat.utils import enable_speaker

        enable_speaker()

    @staticmethod
    def _disable_speaker() -> None:
        # device.disable_speaker is the current robot-hat API; utils is retained
        # as a fallback for older images shipped with PiDog.
        try:
            from robot_hat.device import disable_speaker
        except ImportError:
            from robot_hat.utils import disable_speaker

        disable_speaker()

    def _play_with_speaker(self, action: Callable[[], Any]) -> None:
        """Run a preset action while routing its speak() calls through ALSA."""
        had_instance_speak = "speak" in vars(self._dog)
        previous_instance_speak = vars(self._dog).get("speak")
        self._audio_processes = []
        self._enable_speaker()
        self._dog.speak = self._speak_via_alsa
        try:
            action()
            self._wait_for_audio_processes()
        finally:
            self._stop_audio_processes()
            if had_instance_speak:
                self._dog.speak = previous_instance_speak
            else:
                delattr(self._dog, "speak")
            self._disable_speaker()

    def _speak_via_alsa(self, name: str, volume: int = 100) -> bool:
        sound_path = self._resolve_sound_file(name)
        if sound_path is None:
            raise AudioUnavailableError(f"не найден звуковой файл: {name}")
        if self._audio_player is None:
            raise AudioUnavailableError("SoX play не настроен")

        level = max(0, min(100, int(volume))) / 100
        environment = os.environ.copy()
        environment["AUDIODEV"] = os.environ.get("PIDOG_ALSA_DEVICE", "robothat")
        process = subprocess.Popen(
            [self._audio_player, "-q", "-v", f"{level:.2f}", str(sound_path)],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            env=environment,
        )
        self._audio_processes.append(process)
        return True

    def _resolve_sound_file(self, name: str) -> Path | None:
        direct = Path(name).expanduser()
        if direct.is_file():
            return direct.resolve()
        if self._sound_dir is None:
            return None
        for suffix in ("mp3", "wav"):
            candidate = self._sound_dir / f"{name}.{suffix}"
            if candidate.is_file():
                return candidate.resolve()
        return None

    def _wait_for_audio_processes(self) -> None:
        processes = list(self._audio_processes)
        self._audio_processes.clear()
        for process in processes:
            try:
                _, error_output = process.communicate(timeout=30)
            except subprocess.TimeoutExpired as error:
                process.terminate()
                process.communicate(timeout=2)
                raise AudioUnavailableError("таймаут воспроизведения звука") from error
            if process.returncode != 0:
                detail = (error_output or "").strip()
                raise AudioUnavailableError(
                    detail[-300:] or f"SoX завершился с кодом {process.returncode}")

    def _stop_audio_processes(self) -> None:
        processes = list(self._audio_processes)
        self._audio_processes.clear()
        for process in processes:
            if process.poll() is None:
                process.terminate()
            try:
                process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()

    @staticmethod
    def _configure_pidog_user() -> None:
        """Restore SUDO_USER when a root systemd unit imports upstream PiDog."""
        if os.geteuid() != 0 or os.environ.get("SUDO_USER"):
            return

        configured = os.environ.get("PIDOG_USER")
        if configured:
            try:
                pwd.getpwnam(configured)
            except KeyError:
                LOG.warning("PIDOG_USER does not exist: %s", configured)
            else:
                os.environ["SUDO_USER"] = configured
                LOG.info("PiDog runtime user=%s (from PIDOG_USER)", configured)
                return

        matching_accounts = []
        for account in pwd.getpwall():
            sound_dir = Path(account.pw_dir) / "pidog" / "sounds"
            if all(RobotController._has_sound(sound_dir, name) for name in AUDIO_FILES):
                matching_accounts.append(account)
        if not matching_accounts:
            return

        # Prefer the conventional Raspberry Pi account if several home folders
        # contain old clones; otherwise use the first normal (non-system) user.
        account = next((item for item in matching_accounts if item.pw_name == "pi"),
                       matching_accounts[0])
        os.environ["SUDO_USER"] = account.pw_name
        LOG.info("PiDog runtime user=%s (detected from %s)", account.pw_name,
                 Path(account.pw_dir) / "pidog" / "sounds")

    def _find_sound_dir(self) -> Path | None:
        candidates: list[Path] = []
        configured = os.environ.get("PIDOG_SOUND_DIR")
        if configured:
            candidates.append(Path(configured).expanduser())

        current = getattr(self._dog, "SOUND_DIR", None)
        if current:
            candidates.append(Path(current).expanduser())

        try:
            import pidog as pidog_package

            package_dir = Path(pidog_package.__file__).resolve().parent
            candidates.extend((package_dir / "sounds", package_dir.parent / "sounds"))
        except (ImportError, TypeError, OSError):
            pass

        # Official installation clones the repository into ~/pidog and then
        # installs the Python package. Check every local user's clone because a
        # root system service cannot infer which home owns it.
        for account in pwd.getpwall():
            if account.pw_dir and account.pw_dir != "/root":
                candidates.append(Path(account.pw_dir) / "pidog" / "sounds")
        candidates.extend((Path("/opt/pidog/sounds"), Path("/usr/local/share/pidog/sounds")))

        seen: set[Path] = set()
        for candidate in candidates:
            try:
                candidate = candidate.resolve()
            except OSError:
                continue
            if candidate in seen:
                continue
            seen.add(candidate)
            if all(self._has_sound(candidate, name) for name in AUDIO_FILES):
                return candidate
        return None

    @staticmethod
    def _has_sound(directory: Path, name: str) -> bool:
        return any((directory / f"{name}.{suffix}").is_file()
                   for suffix in ("mp3", "wav"))

    def _require_audio(self) -> None:
        # A missing mount or a temporarily unavailable ALSA device may recover
        # after service startup, so retry preparation on the next sound command.
        if not self._audio_ready:
            self._prepare_audio()
        if not self._audio_ready:
            raise AudioUnavailableError(self._audio_error or "аудио недоступно")

    def _handshake(self) -> None:
        from pidog.preset_actions import hand_shake

        hand_shake(self._dog)

    def _high_five(self) -> None:
        from pidog.preset_actions import high_five

        high_five(self._dog)

    def _nod(self) -> None:
        from pidog.preset_actions import nod

        nod(self._dog)

    def _set_light(self, style: str, color: str, bps: float = 1,
                   brightness: float = 1) -> None:
        self._dog.rgb_strip.set_mode(style=style, color=color, bps=bps, brightness=brightness)

    def _light_command(self, color: str) -> dict[str, Any]:
        self._set_light("breath", color, bps=1.2, brightness=1)
        return {"message": "Подсветка переливается выбранным цветом"}

    def _light_blink(self) -> dict[str, Any]:
        self._set_light("boom", "white", bps=3, brightness=1)
        return {"message": "Подсветка мигает"}

    def _light_off(self) -> dict[str, Any]:
        self._set_light("breath", "#000000", bps=1, brightness=0)
        return {"message": "Подсветка выключена"}

    def _camera_on(self) -> dict[str, Any]:
        self._ensure_camera()
        return {"message": "Камера включена", "camera_url": "http://ROBOT:9000/mjpg"}

    def _camera_off(self) -> dict[str, Any]:
        self._close_camera()
        return {"message": "Камера выключена"}

    def _ensure_camera(self) -> None:
        if self._camera_started:
            return
        from vilib import Vilib

        self._vilib = Vilib
        Vilib.camera_start(vflip=False, hflip=False)
        Vilib.display(local=False, web=True)
        time.sleep(1.5)
        self._camera_started = True

    def _close_camera(self) -> None:
        if not self._camera_started or self._vilib is None:
            return
        try:
            self._vilib.close_color_detection()
        except Exception:
            LOG.debug("could not stop color detection", exc_info=True)
        try:
            self._vilib.camera_close()
        except Exception:
            LOG.debug("could not close camera", exc_info=True)
        self._camera_started = False
        self._vilib = None

    def _find_color(self, color: str) -> dict[str, Any]:
        """Scan for a confirmed color, point with a paw and bark when found."""
        self._ensure_camera()
        self._vilib.color_detect(color=color)
        found: dict[str, float] | None = None
        for scan_yaw in (-40, 0, 40):
            self._dog.head_move([[scan_yaw, 0, 0]], immediately=True, speed=60)
            time.sleep(0.7)
            confirmations = 0
            deadline = time.monotonic() + 2.2
            while time.monotonic() < deadline:
                parameters = dict(self._vilib.detect_obj_parameter)
                count = int(parameters.get("color_n", 0) or 0)
                width = float(parameters.get("color_w", 0) or 0)
                height = float(parameters.get("color_h", 0) or 0)
                if count > 0 and width >= 12 and height >= 12:
                    confirmations += 1
                    found = {
                        "x": float(parameters.get("color_x", 160) or 160),
                        "y": float(parameters.get("color_y", 120) or 120),
                        "w": width, "h": height, "scan_yaw": float(scan_yaw),
                    }
                    if confirmations >= 2:
                        break
                else:
                    confirmations = 0
                time.sleep(0.18)
            if confirmations >= 2:
                break

        if found is None:
            self._dog.head_move([[0, 0, 0]], immediately=True, speed=55)
            self._dog.do_action("shake_head", speed=70)
            return {
                "found": False, "color": color,
                "message": f"Цвет {self._russian_color(color)} не найден — Пайдог показывает «нет»",
            }

        yaw = self._clamp(found["scan_yaw"] + (160 - found["x"]) * 0.30, -70, 70)
        pitch = self._clamp((120 - found["y"]) * 0.22, -25, 25)
        self._dog.do_action("sit", speed=65)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        time.sleep(0.4)

        from pidog.preset_actions import bark, hand_shake

        hand_shake(self._dog)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        if color == "orange":
            self._set_light("boom", "#FF7A00", bps=2.2, brightness=1)
        self._require_audio()
        self._play_with_speaker(
            lambda: bark(self._dog, yrp=[yaw, 0, pitch], volume=100))
        return {
            "found": True, "color": color,
            "x": round(found["x"]), "y": round(found["y"]),
            "message": f"Цвет {self._russian_color(color)} найден — Пайдог указал лапой и залаял",
        }

    def _measure_distance(self) -> dict[str, Any]:
        distance = round(float(self._dog.read_distance()), 1)
        return {"distance_cm": distance, "message": f"Расстояние: {distance:.1f} см"}

    def _listen_sound(self) -> dict[str, Any]:
        deadline = time.monotonic() + 6
        while time.monotonic() < deadline:
            if self._dog.ears.isdetected():
                direction = int(self._dog.ears.read())
                yaw = direction if direction <= 180 else direction - 360
                yaw = self._clamp(yaw, -80, 80)
                self._dog.head_move([[yaw, 0, 0]], immediately=True, speed=65)
                return {
                    "sound_detected": True, "sound_direction": direction,
                    "message": f"Звук обнаружен, направление {direction}°",
                }
            time.sleep(0.1)
        self._dog.do_action("shake_head", speed=70)
        return {"sound_detected": False, "message": "Звук не обнаружен"}

    def _show_battery(self) -> dict[str, Any]:
        voltage = float(self._dog.get_battery_voltage())
        percent = self._battery_percent(voltage)
        lit = max(1, round(percent / 100 * 8)) if percent > 0 else 0
        pixels = []
        for index in range(8):
            if index >= lit:
                pixels.append([0, 0, 0])
            elif index < 2:
                pixels.append([255, 20, 10])
            elif index < 5:
                pixels.append([255, 190, 0])
            else:
                pixels.append([0, 230, 80])
        # Stop the animation loop from overwriting the static eight-LED gauge.
        self._dog.rgb_strip.style = None
        self._dog.rgb_strip.display(pixels)
        return {
            "battery_voltage": round(voltage, 2), "battery_percent": percent,
            "message": f"Заряд примерно {percent}%, напряжение {voltage:.2f} В",
        }

    @staticmethod
    def _battery_percent(voltage: float) -> int:
        # PiDog uses a 2-cell pack: show 0% at 6.4 V and 100% at 8.4 V.
        return round(max(0.0, min(100.0, (voltage - 6.4) / 2.0 * 100.0)))

    @staticmethod
    def _safe_sensor(reader: Callable[[], Any]) -> Any:
        try:
            return reader()
        except Exception as error:
            LOG.warning("sensor read failed: %s", error)
            return None

    def _serializable_sensor(self, reader: Callable[[], Any]) -> Any:
        value = self._safe_sensor(reader)
        if value is None:
            return None
        if hasattr(value, "tolist"):
            value = value.tolist()
        if isinstance(value, (tuple, list)):
            return [round(float(item), 3) for item in value]
        return value

    @staticmethod
    def _clamp(value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    @staticmethod
    def _russian_color(color: str) -> str:
        return {
            "orange": "оранжевый", "red": "красный", "yellow": "жёлтый",
            "green": "зелёный", "blue": "синий", "purple": "фиолетовый",
        }.get(color, color)


class VoiceServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], controller: RobotController,
                 token: str) -> None:
        super().__init__(address, RequestHandler)
        self.controller = controller
        self.token = token


class RequestHandler(BaseHTTPRequestHandler):
    server: VoiceServer

    def do_GET(self) -> None:  # noqa: N802
        if not self._authorized():
            return
        if self.path == "/health":
            self._json(HTTPStatus.OK, {
                "ok": True, "service": "pidog-voice",
                "version": SERVER_VERSION,
                "dry_run": self.server.controller.dry_run,
                "audio": self.server.controller.audio_status,
                "local_voice": self.server.controller.local_voice_status,
                "commands": self.server.controller.commands,
            })
            return
        if self.path == "/sensors":
            try:
                sensors = self.server.controller.sensors()
            except Exception:
                LOG.exception("sensor snapshot failed")
                self._json(HTTPStatus.CONFLICT, {"ok": False, "error": "sensor read failed"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "message": "Датчики обновлены", **sensors})
            return
        self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/command":
            self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
            return
        if not self._authorized():
            return
        if "application/json" not in self.headers.get("Content-Type", ""):
            self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                       {"ok": False, "error": "Content-Type must be application/json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 2 or length > MAX_BODY_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                       {"ok": False, "error": "invalid body size"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid JSON"})
            return
        command = payload.get("command") if isinstance(payload, dict) else None
        if not isinstance(command, str) or command not in self.server.controller.commands:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown command"})
            return
        phrase = payload.get("phrase", "")
        if isinstance(phrase, str):
            LOG.info("recognized_phrase=%r client=%s", phrase[:200], self.client_address[0])
        try:
            result = self.server.controller.execute(command)
        except AudioUnavailableError as error:
            LOG.error("PiDog audio command failed: %s: %s", command, error)
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "audio unavailable",
                "detail": str(error), "command": command,
            })
            return
        except Exception:
            LOG.exception("PiDog command failed: %s", command)
            self._json(HTTPStatus.CONFLICT,
                       {"ok": False, "error": "robot command failed", "command": command})
            return
        self._json(HTTPStatus.ACCEPTED, {"ok": True, "command": command, **result})

    def _authorized(self) -> bool:
        expected = self.server.token
        supplied = self.headers.get("X-PiDog-Token", "")
        if expected and not hmac.compare_digest(supplied, expected):
            self._json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "unauthorized"})
            return False
        return True

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: Any) -> None:
        LOG.info("client=%s %s", self.client_address[0], format_string % args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PiDog V2 Russian voice command bridge")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--token", default=os.environ.get("PIDOG_TOKEN", ""))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if not 1 <= args.port <= 65535:
        raise SystemExit("--port must be between 1 and 65535")
    controller = RobotController(dry_run=args.dry_run)
    server = VoiceServer((args.host, args.port), controller, args.token)

    def request_shutdown(_signal: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)
    LOG.info("PiDog server listening on http://%s:%d token=%s dry_run=%s",
             args.host, args.port, "enabled" if args.token else "disabled", args.dry_run)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
        controller.close()
        LOG.info("PiDog server stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
