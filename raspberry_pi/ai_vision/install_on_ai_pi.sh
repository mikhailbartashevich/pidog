#!/usr/bin/env bash
# Run on the AI Pi with sudo. The source directory is a previously staged copy.
set -euo pipefail

SOURCE_DIR="${1:?usage: install_on_ai_pi.sh /home/mikhail/pidog-ai-vision-stage.../ai_vision}"
TARGET_DIR=/opt/pidog-ai-vision
ENV_FILE=/etc/pidog-ai-vision.env
TOKEN_COPY=/home/mikhail/.config/pidog-ai-vision.token

test -f "$SOURCE_DIR/pidog_ai_vision.py"
test -f "$SOURCE_DIR/pidog-ai-vision.service"

install -d -m 0755 "$TARGET_DIR" "$TARGET_DIR/models"
install -m 0755 "$SOURCE_DIR/pidog_ai_vision.py" "$TARGET_DIR/pidog_ai_vision.py"
install -m 0644 "$SOURCE_DIR/pidog-ai-vision.service" /etc/systemd/system/pidog-ai-vision.service
install -d -o mikhail -g mikhail -m 0750 /var/lib/pidog-ai-vision

if ! test -s "$ENV_FILE"; then
  PIDOG_VISION_TOKEN=$(openssl rand -hex 32)
  printf 'PIDOG_VISION_TOKEN=%s\n' "$PIDOG_VISION_TOKEN" > "$ENV_FILE"
  unset PIDOG_VISION_TOKEN
fi
chmod 0600 "$ENV_FILE"

# This file is readable only by the SSH owner. It allows the deployment helper
# to configure PiDog without ever printing the token to a terminal or log.
install -d -o mikhail -g mikhail -m 0700 /home/mikhail/.config
awk -F= '$1=="PIDOG_VISION_TOKEN" {print $0}' "$ENV_FILE" > "$TOKEN_COPY"
chown mikhail:mikhail "$TOKEN_COPY"
chmod 0600 "$TOKEN_COPY"

systemctl daemon-reload
systemctl enable --now pidog-ai-vision
sleep 3
systemctl is-active --quiet pidog-ai-vision
