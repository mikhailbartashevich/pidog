# PiDog hardware requirements

## Base kit

| Purpose | Required hardware |
| --- | --- |
| Robot | SunFounder PiDog V2 with Robot HAT V5, stock servos, speaker, microphone, and camera |
| Primary robot computer | Raspberry Pi 4B with at least 4 GB RAM, or Raspberry Pi 5 with 8 GB RAM; 64-bit Raspberry Pi OS |
| Power | The recommended SunFounder PiDog battery/power supply and a quality USB-C supply for Raspberry Pi 5 |
| Network | One trusted Wi-Fi/LAN network for the phone, browser, PiDog, and AI Vision when used |
| Control devices | An Android phone and/or a device with a modern browser for the web panel |
| Cooling | A heatsink or active cooling for a Raspberry Pi 5 under sustained load |

Do not run the robot on a table or near an edge. Initial testing needs a clear
floor and access to a physical stop control.

## Configurations

### Robot control only

The base kit is sufficient. The Raspberry Pi inside PiDog runs the primary
service on port `8765`; Android and web clients connect to it over the local
network.

### Local voice assistant

A Raspberry Pi 4B with 4 GB RAM or better is recommended. A Raspberry Pi 5
with 8 GB RAM, active cooling, and reliable power is preferable for local LLM
use.

### AI HAT+ 2 in PiDog

This configuration needs a Raspberry Pi 5 with 8 GB RAM, a Raspberry Pi AI
HAT+ 2 with Hailo-10H, and the HAT heatsink. It is for the local LLM; see
[../../raspberry-pi/AI_HAT_2/README.md](../../raspberry-pi/AI_HAT_2/README.md).

### Separate AI Vision server

This requires a second computer independent from PiDog:

- Raspberry Pi 5 with 8 GB RAM;
- Raspberry Pi AI HAT+ 2 with Hailo-10H;
- active cooling and a separate quality USB-C power supply;
- Ethernet is preferred; stable Wi-Fi is acceptable;
- microSD or SSD capacity for Raspberry Pi OS, Hailo Apps, models, and the
  local face/object SQLite memory.

The second Pi never controls servos and does not keep a video stream. It
receives JPEG frames from PiDog only when requested. Full setup instructions
are in [../../ai-vision/README.md](../../ai-vision/README.md).

## Network and secrets

Assign stable addresses with DHCP reservations. Keep port `8765` (PiDog API)
and `8790` (AI Vision) inside the home/trusted network. Use separate random
`PIDOG_TOKEN` and `PIDOG_VISION_TOKEN` values.
