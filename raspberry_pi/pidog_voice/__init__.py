"""PiDog voice server package."""

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
