#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer with sudo: sudo ./install.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${PIDOG_INSTALL_DIR:-/opt/pidog-voice-ai-hat2}"
ENV_FILE="${PIDOG_ENV_FILE:-/etc/pidog-voice-ai-hat2.env}"
MODEL="${PIDOG_LLM_NAME:-qwen2:1.5b}"
GENAI_DEB_URL="${PIDOG_HAILO_GENAI_DEB_URL:-https://dev-public.hailo.ai/2025_12/Hailo10/hailo_gen_ai_model_zoo_5.1.1_arm64.deb}"

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "This bundle targets 64-bit Raspberry Pi OS on Raspberry Pi 5 (aarch64)." >&2
  exit 1
fi

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  if [[ "${VERSION_CODENAME:-}" != "trixie" ]]; then
    echo "Warning: official AI HAT+ 2 instructions currently target Raspberry Pi OS Trixie; detected ${VERSION_CODENAME:-unknown}." >&2
  fi
fi

echo "Installing OS dependencies and the Hailo-10H runtime..."
apt-get update
apt-get install -y dkms python3-venv python3-pip sox libsox-fmt-all alsa-utils curl openssl
apt-get install -y hailo-h10-all

if ! command -v hailortcli >/dev/null || ! hailortcli fw-control identify >/dev/null 2>&1; then
  echo "Hailo-10H is not ready yet. Reboot the Raspberry Pi and run sudo ./install.sh again." >&2
  exit 2
fi

echo "Installing the Hailo GenAI Model Zoo package..."
TMP_DEB="$(mktemp /tmp/pidog-hailo-genai.XXXXXX.deb)"
trap 'rm -f "$TMP_DEB"' EXIT
curl --fail --location --retry 4 --output "$TMP_DEB" "$GENAI_DEB_URL"
dpkg -i "$TMP_DEB"

install -d -m 0755 "$INSTALL_DIR"
install -d -m 0755 "$INSTALL_DIR/pidog_voice"
cp -a "$SCRIPT_DIR/../pidog_voice_server.py" "$INSTALL_DIR/"
cp -a "$SCRIPT_DIR/../common/pidog_voice/." "$INSTALL_DIR/pidog_voice/"
cp -a "$SCRIPT_DIR/pidog_voice/." "$INSTALL_DIR/pidog_voice/"
install -m 0644 "$SCRIPT_DIR/pidog-voice.service" /etc/systemd/system/pidog-voice-ai-hat2.service
install -m 0644 "$SCRIPT_DIR/pidog-hailo-ollama.service" /etc/systemd/system/pidog-hailo-ollama.service

if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  token="$(openssl rand -hex 32)"
  install -d -m 0755 "$(dirname -- "$ENV_FILE")"
  {
    printf 'PIDOG_TOKEN=%s\n' "$token"
    pidog_user="${SUDO_USER:-pi}"
    [[ "$pidog_user" == "root" ]] && pidog_user=pi
    printf 'PIDOG_USER=%s\n' "$pidog_user"
    printf 'PIDOG_VOICE_LANGUAGE=ru\nPIDOG_ALSA_DEVICE=robothat\n'
    printf 'PIDOG_LLM_URL=http://127.0.0.1:8000\n'
    printf 'PIDOG_LLM_READY_PATH=/hailo/v1/list\n'
    printf 'PIDOG_LLM_NAME=%s\n' "$MODEL"
    printf 'PIDOG_LLM_UNIT=pidog-hailo-ollama.service\nPIDOG_SYSTEMD_SCOPE=system\n'
  } > "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
  echo "Generated token in $ENV_FILE"
fi

echo "Reloading systemd and starting Hailo Ollama..."
systemctl daemon-reload
systemctl enable --now pidog-hailo-ollama.service

for _ in {1..60}; do
  if curl --silent --fail http://127.0.0.1:8000/hailo/v1/list >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:8000/hailo/v1/list >/dev/null || {
  systemctl --no-pager --full status pidog-hailo-ollama.service || true
  echo "Hailo Ollama did not become ready" >&2
  exit 1
}

echo "Downloading Hailo model: $MODEL"
curl --fail --silent http://127.0.0.1:8000/api/pull \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"stream\":false}" >/dev/null

echo "Verifying Hailo device..."
hailortcli fw-control identify >/dev/null

systemctl enable --now pidog-voice-ai-hat2.service
echo "PiDog AI HAT+ 2 server is ready on port 8765"
