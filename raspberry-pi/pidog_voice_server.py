#!/usr/bin/env python3
"""Backward-compatible executable entry point for the PiDog voice service."""

from pidog_voice import (
    AudioUnavailableError,
    LocalVoiceListener,
    RequestHandler,
    RobotController,
    VoiceServer,
    main,
    match_local_voice_command,
    normalize_voice_phrase,
    parse_args,
)

__all__ = [
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


if __name__ == "__main__":
    raise SystemExit(main())
