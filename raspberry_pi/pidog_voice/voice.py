"""Offline voice phrase matching and listener lifecycle."""

from __future__ import annotations

import json
import os
import re
import threading
import unicodedata
from typing import Any, Callable

from .constants import LOG


VOICE_FILLERS = {
    "пайдог", "пес", "песик", "собака", "собачка", "робот",
    "эй", "ну", "давай", "пожалуйста", "команда", "теперь", "быстро",
}

# Local recognition deliberately uses an exact allow-list after punctuation and
# filler words are removed. A doubtful phrase must never move the robot.
LOCAL_VOICE_ALIASES: dict[str, tuple[str, ...]] = {
    "stop": ("стоп", "стой", "остановись", "замри", "не двигайся", "прекрати", "хватит"),
    "forward": ("вперед", "иди вперед", "двигайся вперед", "шагай вперед", "иди прямо"),
    "approach_obstacle": (
        "иди до препятствия", "иди вперед до препятствия", "найди препятствие",
        "остановись перед препятствием", "подойди к предмету",
    ),
    "backward": ("назад", "иди назад", "двигайся назад", "шагай назад", "сдай назад"),
    "turn_left": ("налево", "влево", "поверни налево", "поверни влево"),
    "turn_right": ("направо", "вправо", "поверни направо", "поверни вправо"),
    "sit": ("сидеть", "сесть", "сядь", "садись", "присядь"),
    "stand": ("встать", "встань", "поднимись", "на ноги"),
    "lie": ("лежать", "лечь", "ляг", "ложись", "приляг"),
    "bark": ("голос", "подай голос", "гав", "гавкни", "залай", "лай три раза"),
    "wag_tail": (
        "хвост", "виляй хвостом", "повиляй хвостом", "вильни хвостом",
        "помаши хвостом", "махай хвостом",
    ),
    "shake_head": ("покачай головой", "потряси головой", "качай головой"),
    "nod_yes": ("кивни", "скажи да", "покажи да"),
    "stretch": ("потянись", "потягушки", "сделай потягушки", "растяжка", "сделай растяжку"),
    "push_up": ("отжимайся", "отожмись", "сделай отжимание", "сделай отжимания"),
    "handshake": ("дай лапу", "лапу", "пожми руку"),
    "high_five": ("дай пять", "дай мне пять", "пять", "ладушки", "хай файв"),
    "howl": ("вой", "завой", "выть", "повой"),
    "sleep": ("спать", "засыпай", "усни", "дремать", "отдыхай"),
    "measure_distance": (
        "измерь расстояние", "расстояние до предмета", "скажи расстояние",
        "какое расстояние", "дистанция", "что впереди",
    ),
    "listen_sound": ("слушай звук", "найди звук", "откуда звук", "слушай хлопок"),
    "show_battery": ("покажи заряд", "сколько заряда", "заряд батареи", "покажи батарею"),
    "find_orange": (
        "найди оранжевый", "найди оранжевый цвет", "найти оранжевый цвет",
        "покажи оранжевый", "найди оранжевую баночку",
    ),
    "find_red": ("найди красный", "найди красный цвет", "найти красный цвет", "покажи красный"),
    "find_yellow": ("найди желтый", "найди желтый цвет", "найти желтый цвет", "покажи желтый"),
    "find_green": ("найди зеленый", "найди зеленый цвет", "найти зеленый цвет", "покажи зеленый"),
    "find_blue": ("найди синий", "найди синий цвет", "найти синий цвет", "покажи синий"),
    "find_purple": (
        "найди фиолетовый", "найди фиолетовый цвет", "найти фиолетовый цвет",
        "покажи фиолетовый",
    ),
    "follow_face": ("следи за лицом", "следуй за лицом", "найди лицо", "смотри на меня"),
    "stop_face_follow": (
        "перестань следить за лицом", "не следи за лицом", "останови слежение за лицом",
    ),
    "follow_object": (
        "следи за предметом", "следуй за предметом", "следи за объектом",
        "следи за тем что в центре", "запомни предмет в центре",
    ),
    "stop_object_follow": (
        "перестань следить за предметом", "не следи за предметом",
        "останови слежение за предметом", "перестань следить за объектом",
    ),
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
                 recognizer_factory: Callable[[], Any] | None = None,
                 conversation: Callable[[str], None] | None = None) -> None:
        self._execute = execute
        self._recognizer_factory = recognizer_factory or self._create_recognizer
        self._conversation = conversation
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
                    if self._conversation is not None:
                        self._conversation(phrase)
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
