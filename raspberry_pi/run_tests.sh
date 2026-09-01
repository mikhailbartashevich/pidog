#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

run_variant() {
  local variant="$1"
  echo "== PiDog tests: $variant =="
  PIDOG_TEST_VARIANT="$variant" "$PYTHON_BIN" \
    "$SCRIPT_DIR/common/test_pidog_voice_server.py" -q
}

run_variant root
run_variant v4
run_variant ai_hat_2
