"""PiDog voice server package."""

from pathlib import Path

# Shared implementation lives in raspberry_pi/common. Hailo-specific
# assistant/constants modules stay first so this bundle uses AI HAT+ 2 backend.
_COMMON_PACKAGE = Path(__file__).resolve().parents[2] / "common" / "pidog_voice"
if _COMMON_PACKAGE.is_dir():
    __path__.append(str(_COMMON_PACKAGE))

from .audio import AudioUnavailableError
from .assistant import AssistantManager, AssistantUnavailableError
from .cli import main, parse_args
from .controller import RobotController
from .http_api import RequestHandler, VoiceServer
from .voice import LocalVoiceListener, match_local_voice_command, normalize_voice_phrase

__all__ = [
    "AssistantManager",
    "AssistantUnavailableError",
    "AudioUnavailableError",
    "LocalVoiceListener",
    "RequestHandler",
    "RobotController",
    "VoiceServer",
    "main",
    "match_local_voice_command",
    "normalize_voice_phrase",
    "parse_args",
]
