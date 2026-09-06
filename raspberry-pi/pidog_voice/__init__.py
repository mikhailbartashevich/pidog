"""PiDog voice server package."""

from pathlib import Path

# The canonical runtime is shared by the root/legacy entry point, V4, and the
# AI HAT+ 2 bundle. AI HAT+ 2 adds its own assistant/constants before this path.
_COMMON_PACKAGE = Path(__file__).resolve().parents[1] / "common" / "pidog_voice"
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
