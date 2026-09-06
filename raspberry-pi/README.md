# Primary PiDog server

This directory contains the service that runs on the Raspberry Pi inside
PiDog. It controls motion, lighting, audio, sensors, and the camera; exposes
the authenticated HTTP API on port `8765`; and can pass frames to a separate
AI Vision service.

## Choose a configuration

- **Standard PiDog / CPU LLM:** use the root files in this directory and the
  `V4/` variant. A clean installation guide is in
  [V4/SETUP_FROM_SCRATCH.md](V4/SETUP_FROM_SCRATCH.md).
- **Raspberry Pi 5 + AI HAT+ 2:** follow
  [AI_HAT_2/README.md](AI_HAT_2/README.md).

Shared code is in `common/pidog_voice/`; `pidog_voice_server.py` is the
backward-compatible entry point. From the repository root, test every server
variant with:

```bash
bash raspberry-pi/run_tests.sh
```

## Minimal development run

Install the official SunFounder `robot-hat`, `vilib`, and `pidog` packages
first. Copy this directory to the Raspberry Pi, then run:

```bash
cd /path/to/raspberry-pi
sudo env PIDOG_TOKEN='long-random-token' python3 pidog_voice_server.py
```

To test without moving servos:

```bash
python3 pidog_voice_server.py --dry-run --host 127.0.0.1
```

`pidog-voice.service` is the systemd service template. To connect the second
Pi, add `PIDOG_VISION_URL`, `PIDOG_VISION_TOKEN`, and
`PIDOG_VISION_TIMEOUT` to the service environment. See
[../ai-vision/README.md](../ai-vision/README.md) for details.
