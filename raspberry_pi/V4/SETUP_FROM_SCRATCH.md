# PiDog Raspberry Pi 4 setup from scratch

This guide reproduces the setup for a **Raspberry Pi 4 Model B with 4 GB RAM**
running 64-bit Raspberry Pi OS / Debian Trixie. It is the CPU-only PiDog setup;
it does not use an AI HAT.

It installs the official SunFounder hardware stack, the authenticated PiDog API
on port `8765`, and the optional loopback-only local assistant on port `8081`.
Do not commit or share `/etc/pidog-voice.env`: it contains the client API token.

## Before you begin

On the administrator computer, set these shell variables once and use them in
the commands below. The quoted placeholders are intentionally not real values.

```bash
export PI_HOST="<PI_LAN_ADDRESS_OR_HOSTNAME>"
export PI_USER="<PI_LINUX_USERNAME>"
export PI_SSH_KEY="$HOME/.ssh/pidog_install_ed25519"
```

## 1. Install and verify the operating system

Use Raspberry Pi Imager to write the current 64-bit Raspberry Pi OS image. In
its customisation dialog, set a hostname, create a normal user, configure Wi-Fi
if required, and enable SSH.

From a trusted LAN, verify the fresh machine:

```bash
ssh "$PI_USER@$PI_HOST"
uname -m
tr -d '\0' </proc/device-tree/model; echo
grep '^MemTotal:' /proc/meminfo
```

For this deployment the expected values are `aarch64`, `Raspberry Pi 4 Model B`,
and approximately `3880000 kB` (a 4 GB model).

## 2. Generate and install an SSH key

On the administrator Mac, create a dedicated Ed25519 key once. Do not overwrite
an existing key unless that is intentional:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/pidog_install_ed25519 -C "pidog-install"
```

After reinstalling an operating system, SSH rightfully warns that the old host
key no longer matches. First verify the new host fingerprint **at the Pi
console**:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Only if it matches the fingerprint shown by the Mac, remove the old entry and
connect once with the user's password:

```bash
ssh-keygen -R "$PI_HOST"
ssh "$PI_USER@$PI_HOST"
```

Type `yes` to accept the verified host key. Password characters are intentionally
not displayed. Leave the remote shell with `exit`, then copy the administrator
public key:

```bash
ssh-copy-id -i "$PI_SSH_KEY.pub" "$PI_USER@$PI_HOST"
ssh -i "$PI_SSH_KEY" -o PasswordAuthentication=no "$PI_USER@$PI_HOST"
```

The final command must log in without requesting a password. Keep password
authentication enabled until this has been tested from another terminal.

### Optional: unattended administrator setup

An automated SSH session cannot safely type the user's `sudo` password. If a
trusted administrator is completing the setup remotely, create a temporary
passwordless sudo rule from a terminal on the Pi, after reviewing the command:

```bash
echo "${USER} ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/pidog-setup
sudo chmod 0440 /etc/sudoers.d/pidog-setup
sudo visudo -cf /etc/sudoers.d/pidog-setup
```

Remove it once automated installation and maintenance no longer need it:

```bash
sudo rm /etc/sudoers.d/pidog-setup
```

## 3. Install the official SunFounder hardware stack

Run this as the normal Pi user. It follows SunFounder's supported PiDog module
installation order. Debian requires `--break-system-packages` for the upstream
PiDog Python package.

```bash
sudo env DEBIAN_FRONTEND=noninteractive apt-get update
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git python3-pip python3-setuptools python3-smbus python3-venv \
  sox libsox-fmt-all alsa-utils curl openssl build-essential pkg-config

git clone -b 2.5.x --depth=1 https://github.com/sunfounder/robot-hat.git ~/robot-hat
cd ~/robot-hat
sudo python3 install.py

git clone --depth=1 https://github.com/sunfounder/vilib.git ~/vilib
cd ~/vilib
sudo python3 install.py

git clone --depth=1 https://github.com/sunfounder/pidog.git ~/pidog
sudo python3 -m pip install --break-system-packages ~/pidog
```

For PiDog V2 with Robot HAT V5, enable its microphone-capable I2S overlay. The
current vendor helper does not reliably detect a V5 that has no device-tree
EEPROM entry, so use the checked-in `robothat-v5.asound.conf` instead. Back up
the existing configuration, install the overlay and ALSA config, then reboot.

First, on the administrator computer, copy that config to the Pi:

```bash
scp -i "$PI_SSH_KEY" raspberry_pi/V4/robothat-v5.asound.conf \
  "$PI_USER@$PI_HOST:~/robothat-v5.asound.conf"
```

Then, on the Pi:

```bash
sudo cp -an /boot/firmware/config.txt /boot/firmware/config.txt.before-pidog
grep -q '^dtoverlay=googlevoicehat-soundcard$' /boot/firmware/config.txt || \
  echo 'dtoverlay=googlevoicehat-soundcard' | sudo tee -a /boot/firmware/config.txt
sudo cp -an /etc/asound.conf /etc/asound.conf.before-pidog 2>/dev/null || true
sudo install -m 0644 "$HOME/robothat-v5.asound.conf" /etc/asound.conf
sudo reboot
```

After reconnecting, confirm the `snd_rpi_googlevoicehat_soundcar` playback and
capture card, then check the PiDog library:

```bash
arecord -l
aplay -l
python3 -c 'from pidog import Pidog; print("PiDog library available")'
```

## 4. Deploy the PiDog voice service

From the development computer, create a staging directory and copy the project
server code. Run these commands from the repository root:

```bash
ssh -i "$PI_SSH_KEY" "$PI_USER@$PI_HOST" 'mkdir -p ~/pidog-voice-staging'
scp -i "$PI_SSH_KEY" raspberry_pi/pidog_voice_server.py \
  raspberry_pi/pidog_voice/__init__.py \
  raspberry_pi/V4/pidog-voice.service \
  "$PI_USER@$PI_HOST:~/pidog-voice-staging/"
scp -r -i "$PI_SSH_KEY" raspberry_pi/common/pidog_voice \
  "$PI_USER@$PI_HOST:~/pidog-voice-staging/"
```

On the Pi, install it and generate the API token locally:

```bash
SRC="$HOME/pidog-voice-staging"
PIDOG_USER=$(id -un)
PIDOG_HOME=$(getent passwd "$PIDOG_USER" | cut -d: -f6)
sudo install -d -m 0755 /opt/pidog-voice/pidog_voice /opt/pidog-voice/common/pidog_voice
sudo install -m 0644 "$SRC/pidog_voice_server.py" /opt/pidog-voice/pidog_voice_server.py
sudo install -m 0644 "$SRC/__init__.py" /opt/pidog-voice/pidog_voice/__init__.py
sudo cp -a "$SRC/pidog_voice/." /opt/pidog-voice/common/pidog_voice/
sudo install -m 0644 "$SRC/pidog-voice.service" /etc/systemd/system/pidog-voice.service
TOKEN=$(openssl rand -hex 32)
sudo sh -c "printf '%s\n' 'PIDOG_TOKEN=$TOKEN' 'PIDOG_USER=$PIDOG_USER' 'PIDOG_VOICE_LANGUAGE=ru' 'PIDOG_ALSA_DEVICE=robothat' 'PIDOG_SOUND_DIR=$PIDOG_HOME/pidog/sounds' 'PIDOG_LLM_URL=http://127.0.0.1:8081' 'PIDOG_LLM_UNIT=pidog-llm.service' 'PIDOG_SYSTEMD_SCOPE=user' > /etc/pidog-voice.env"
sudo chmod 0600 /etc/pidog-voice.env
sudo systemctl daemon-reload
sudo systemctl enable --now pidog-voice.service
```

Retrieve the token only on a trusted machine when configuring the Android or web
client:

```bash
sudo awk -F= '$1 == "PIDOG_TOKEN" { print $2 }' /etc/pidog-voice.env
```

Test health without commanding motion:

```bash
TOKEN=$(sudo awk -F= '$1 == "PIDOG_TOKEN" { print $2 }' /etc/pidog-voice.env)
curl --fail --silent -H "X-PiDog-Token: $TOKEN" http://127.0.0.1:8765/health
```

The API is HTTP by design. Keep port `8765` on a trusted LAN; never expose it
to the public internet.

## 5. Install the optional local assistant

The included assistant builds `llama.cpp`, downloads Qwen3.5 2B Q4_K_M and the
Piper Russian voice, and starts the model only on `127.0.0.1:8081`. Its unit
limits memory to 2.8 GB, which is appropriate for this 4 GB Pi.

From the administrator computer:

```bash
scp -i "$PI_SSH_KEY" raspberry_pi/V4/install_local_llm.sh raspberry_pi/V4/pidog-llm.service \
  "$PI_USER@$PI_HOST:~/pidog-voice-staging/"
```

On the Pi:

```bash
SRC="$HOME/pidog-voice-staging"
PIDOG_USER=$(id -un)
chmod +x "$SRC/install_local_llm.sh"
sudo loginctl enable-linger "$PIDOG_USER"
"$SRC/install_local_llm.sh"
systemctl --user status pidog-llm.service --no-pager
curl --fail --silent http://127.0.0.1:8081/health
```

The first installation downloads a multi-gigabyte model and compiles the model
server, so it can take a while. Do not change the model endpoint to a LAN-facing
address.

## 6. Verify and maintain

```bash
systemctl is-active pidog-voice.service
systemctl --user is-active pidog-llm.service
sudo journalctl -u pidog-voice.service -n 50 --no-pager
journalctl --user -u pidog-llm.service -n 50 --no-pager
```

Before first use of PiDog's built-in microphone, initialise the Russian Vosk
model while online, then restart the service:

```bash
sudo python3 -c 'from pidog.stt import Vosk; Vosk(language="ru")'
sudo systemctl restart pidog-voice.service
```
