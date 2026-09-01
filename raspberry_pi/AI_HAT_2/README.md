# PiDog server — Raspberry Pi 5 8GB + AI HAT+ 2 8GB

This is a separate setup for the official Raspberry Pi AI HAT+ 2 board, also commonly called AI HAT 2+. It uses Hailo-10H for a local LLM through `hailo-ollama`; motor, audio, sensor, and HTTP API control remains in the PiDog server.

## Requirements

- Raspberry Pi 5 8GB with 64-bit Raspberry Pi OS Trixie;
- AI HAT+ 2 with Hailo-10H;
- active cooling for Raspberry Pi 5 and the standard AI HAT+ 2 heatsink;
- the official SunFounder stack installed: `robot_hat`, `vilib`, and `pidog`;
- a camera and PiDog sounds only if you need camera or bark/howl features.

Manual PCIe Gen 3 configuration is not required for AI HAT+ 2; it is applied automatically. After assembling the hardware, update the operating system and install the Hailo packages first.

## Install on Raspberry Pi

Copy the `raspberry_pi/` directory to the Pi, preserving `AI_HAT_2/`, `common/`, and the root-level `pidog_voice_server.py`, then run:

```bash
cd AI_HAT_2
sudo ./install.sh
```

The script installs `hailo-h10-all`, system dependencies, and Hailo GenAI Model Zoo 5.1.1; starts `hailo-ollama` only on `127.0.0.1:8000`; downloads the `qwen2:1.5b` model; installs the PiDog API as `pidog-voice-ai-hat2.service` on port `8765`; and generates a token in `/etc/pidog-voice-ai-hat2.env`. After the initial driver installation, the script may ask you to reboot the Pi and run it again.

If the GenAI package has moved, override its URL with:

```bash
sudo PIDOG_HAILO_GENAI_DEB_URL='https://...' ./install.sh
```

Check the hardware and services:

```bash
sudo ./check_hailo.sh
sudo systemctl status pidog-hailo-ollama pidog-voice-ai-hat2
curl --silent http://127.0.0.1:8000/hailo/v1/list
```

Check the PiDog server with the token from the environment file:

```bash
TOKEN=$(sudo awk -F= '$1=="PIDOG_TOKEN" {print $2}' /etc/pidog-voice-ai-hat2.env)
curl --silent -H "X-PiDog-Token: $TOKEN" http://127.0.0.1:8765/health
```

## Model and limitations

The default model is `qwen2:1.5b`, from Hailo's official AI HAT+ 2 example. You can select another model from Hailo's list with `PIDOG_LLM_NAME` before installation. Port `8000` is intentionally available only locally; only the authenticated PiDog API on port `8765` is exposed externally.

Avoid running `apt full-upgrade` unnecessarily after installing Hailo GenAI: the driver, HailoRT, and Model Zoo versions must remain compatible.

## Update the code

```bash
sudo cp -a ../pidog_voice_server.py /opt/pidog-voice-ai-hat2/
sudo cp -a ../common/pidog_voice/. /opt/pidog-voice-ai-hat2/pidog_voice/
sudo cp -a pidog_voice/. /opt/pidog-voice-ai-hat2/pidog_voice/
sudo systemctl restart pidog-voice-ai-hat2
sudo journalctl -u pidog-voice-ai-hat2 -n 50 --no-pager
```

Check all server variants from the source directory:

```bash
cd ..
./run_tests.sh
```
