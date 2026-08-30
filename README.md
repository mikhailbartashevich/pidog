# PiDog V2 — Voice Control for Android

This native Android app recognizes speech, selects a command from a safe allowlist, and sends it to a Raspberry Pi over the local network. A small Python server on the Pi invokes the official `pidog` library.

## What already works

- Russian (`ru-RU`) and English (`en-US`) speech recognition;
- a persistent interface and command-language selector, with Russian as the default;
- PiDog phrase hints for the recognizer on Android 13 and newer;
- validation of up to eight alternative recognition results;
- Russian and English command dictionaries with natural phrase variants;
- conservative fuzzy matching, so uncertain phrases are not sent to the robot;
- manual controls for connection testing and an emergency `STOP` button;
- a shared secret token to prevent accidental commands from other devices on the local network;
- a server-side `--dry-run` mode that never moves the robot.

Supported actions: move forward, move backward, turn left or right, stop, sit, stand, lie down, bark, wag the tail, shake the head, stretch, do push-ups, shake hands, high-five, howl, and sleep.

## 1. Run the server on PiDog

First, install the official `robot-hat`, `vilib`, and `pidog` modules. See SunFounder’s [Install All the Modules](https://docs.sunfounder.com/projects/pidog/en/latest/python/python_start/install_all_modules.html) guide.

Copy the server to the Raspberry Pi, then run:

```bash
cd /path/to/pidog/raspberry_pi
sudo env PIDOG_TOKEN='choose-a-long-password' python3 pidog_voice_server.py
```

The server listens on port `8765`. To find the robot’s IP address, run:

```bash
hostname -I
```

For a safe test without moving the servos:

```bash
python3 pidog_voice_server.py --dry-run --host 127.0.0.1
```

### Start automatically

The repository includes the `raspberry_pi/pidog-voice.service` template. It expects the server in `/opt/pidog-voice/` and the token in `/etc/pidog-voice.env`:

```bash
sudo mkdir -p /opt/pidog-voice
sudo cp raspberry_pi/pidog_voice_server.py /opt/pidog-voice/
sudo cp -R raspberry_pi/pidog_voice /opt/pidog-voice/
```

```text
PIDOG_TOKEN=choose-a-long-password
# The server normally discovers the sound files automatically. If the pidog
# repository is elsewhere, specify the directory containing single_bark_1 and
# howling explicitly:
PIDOG_SOUND_DIR=/home/pi/pidog/sounds
# If the installation owner is not named pi, specify that user as well:
PIDOG_USER=pi
# Optional: the exact sysfs path for external power, if available:
PIDOG_EXTERNAL_POWER_PATH=/sys/class/power_supply/usb/online
# Offline recognition language for the microphone built into PiDog V2:
PIDOG_VOICE_LANGUAGE=ru
```

After copying the files and checking the paths:

```bash
sudo cp raspberry_pi/pidog-voice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pidog-voice
sudo systemctl status pidog-voice
```

### Use PiDog's built-in microphone for commands

PiDog V2 can switch from the phone microphone to the microphone on Robot HAT V5. The server uses SunFounder's offline Vosk integration, so commands continue working without the phone after the Russian model has been downloaded.

Before the first use, verify that Raspberry Pi sees the capture device:

```bash
arecord -l
```

Then initialize the Russian Vosk model once. The first run downloads the small model and therefore needs internet access:

```bash
sudo python3 -c 'from pidog.stt import Vosk; Vosk(language="ru")'
```

Restart the service after updating it. In the Android app, say **“Пайдог, перейди в режим слушать”** or select **“Слушать через микрофон Пайдог”** from the command list. After the server confirms the command, the phone is no longer needed: speak commands 15–30 cm from PiDog. Say **“Пайдог, перестань слушать”** to stop local recognition. The `/health` response exposes the current mode in `local_voice` and any Vosk or microphone startup error in `local_voice.error`.

The similarly named **“слушай звук”** command remains a separate six-second sound-direction action and does not start speech recognition.

### If the “Bark” and “Howl” commands produce no sound

The server enables the amplifier only while barking or howling, then disables it again so the speaker does not hiss while idle. Audio is played directly through SoX and ALSA. The server searches for the standard PiDog sounds in both the `root` home directory and regular users’ home directories. The `/health` response reports the audio state in its `audio` field.

After updating the server and unit files, apply the changes:

```bash
sudo cp raspberry_pi/pidog_voice_server.py /opt/pidog-voice/
sudo cp -R raspberry_pi/pidog_voice /opt/pidog-voice/
sudo cp raspberry_pi/pidog-voice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart pidog-voice
sudo journalctl -u pidog-voice -n 50 --no-pager
```

The journal should contain a `PiDog audio ready` line with the detected sound directory. If it reports that no sounds were found, set `PIDOG_SOUND_DIR` in `/etc/pidog-voice.env`. If the directory is found but ALSA cannot be opened, run the official I2S setup once and reboot the Raspberry Pi:

```bash
cd ~/robot-hat
sudo bash i2samp.sh
sudo reboot
```

## 2. Build the Android app

Requirements: Android Studio, or JDK 17+ and Android SDK 36. The project uses AGP 9.3 and Gradle 9.5. JDK 17 remains the target Java toolchain for maximum Android code compatibility.

1. Open the project root in Android Studio.
2. Wait for Gradle Sync to finish.
3. Connect a phone with USB debugging enabled and click Run, or choose **Build → Build APK(s)**.
4. The APK will be created at `app/build/outputs/apk/debug/app-debug.apk`.

To build from the command line:

```bash
./gradlew test assembleDebug
```

## 3. Connect the phone

1. Connect the phone and PiDog to the same Wi-Fi network.
2. Choose **Русский** or **English** in the language selector. Russian is selected by default; the choice controls both the interface and voice commands and is saved between launches.
3. In the app, enter the Raspberry Pi IP address, port `8765`, and the same token.
4. Tap **Check connection**.
5. Tap the green microphone and say, for example, “Пайдог, пожалуйста, сядь” or “PiDog, please sit.”

For the best recognition quality, use Google’s system speech recognizer and a regular home Wi-Fi network with internet access. If the phone connects directly to the PiDog access point without internet, download the Russian or English offline recognition pack in Google Voice Typing settings beforehand. Offline recognition may be less accurate.

## Safety

Before the first test, place PiDog on the floor with enough free space around it. The server accepts only predefined commands, limits request sizes, and compares the token securely. HTTP is intended only for a trusted local network; do not expose port `8765` to the internet.

## Project structure

- `app/` — Android app written in Java with no third-party runtime dependencies;
- `app/src/main/java/ru/pidog/voice/CommandParser.java` — Russian and English phrase dictionaries with safe command matching;
- `raspberry_pi/pidog_voice_server.py` — backward-compatible server entry point;
- `raspberry_pi/pidog_voice/` — server package split into voice, hardware, sensor,
  camera, HTTP, and command-line modules;
- `raspberry_pi/test_pidog_voice_server.py` — server-side dry-run tests.
