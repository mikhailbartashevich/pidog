#!/usr/bin/env bash
set -euo pipefail

echo "== OS =="
uname -a
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  echo "${PRETTY_NAME:-unknown} (${VERSION_CODENAME:-unknown})"
fi

echo "== Hailo device =="
command -v hailortcli >/dev/null || { echo "hailortcli not found; install hailo-h10-all" >&2; exit 1; }
hailortcli fw-control identify

echo "== Kernel =="
dmesg | grep -i hailo | tail -20 || true

echo "== Hailo Ollama =="
command -v hailo-ollama >/dev/null || { echo "hailo-ollama not found; install Hailo GenAI Model Zoo" >&2; exit 1; }
curl --fail --silent http://127.0.0.1:8000/hailo/v1/list
echo
