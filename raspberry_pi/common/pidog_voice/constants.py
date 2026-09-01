"""Shared service constants."""

from __future__ import annotations

import logging


LOG = logging.getLogger("pidog-voice")
MAX_BODY_BYTES = 16 * 1024
AUDIO_FILES = ("single_bark_1", "howling")
# A sound effect is only a few seconds long.  Keeping this short is important:
# ALSA can otherwise leave the command lock held indefinitely after a device
# failure, making the control service look unavailable.
AUDIO_PLAYBACK_TIMEOUT_SECONDS = 6
SERVER_VERSION = "1.5.0"

COMMAND_COLORS = {
    "stop": "#FF3030", "forward": "#21D07A", "backward": "#00B8D9",
    "turn_left": "#7C4DFF", "turn_right": "#FF4FA3", "sit": "#FFD54F",
    "stand": "#4DD0E1", "lie": "#8D6E63", "bark": "#FF6D00",
    "wag_tail": "#FF80AB", "shake_head": "#9575CD", "nod_yes": "#66BB6A",
    "stretch": "#26A69A", "push_up": "#EF5350", "handshake": "#42A5F5",
    "high_five": "#FFCA28", "howl": "#5C6BC0", "sleep": "#3949AB",
    "approach_obstacle": "#00A878", "follow_face": "#EC407A",
    "stop_face_follow": "#78909C", "follow_object": "#7E57C2",
    "stop_object_follow": "#78909C",
    "measure_distance": "#26C6DA", "listen_sound": "#AB47BC",
    "show_battery": "#66BB6A",
    "local_voice_on": "#00D9FF", "local_voice_off": "#78909C",
    "find_orange": "#FF7A00", "find_red": "#FF2020", "find_yellow": "#FFE000",
    "find_green": "#20D060", "find_blue": "#2080FF", "find_purple": "#A020F0",
}
