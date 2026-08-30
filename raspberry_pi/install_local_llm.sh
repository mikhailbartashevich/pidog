#!/bin/sh
# Install the pinned, loopback-only PiDog assistant without root privileges.
set -eu

PIDOG_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PIDOG_LLM_ROOT=${PIDOG_LLM_ROOT:-"$HOME/.local/share/pidog-llm"}
PIDOG_BIN_DIR=${PIDOG_BIN_DIR:-"$HOME/.local/bin"}
PIDOG_UNIT_DIR=${PIDOG_UNIT_DIR:-"$HOME/.config/systemd/user"}
PIDOG_LLAMA_REF=${PIDOG_LLAMA_REF:-bebc9350ecc42a31ad119da1513998386671cf5b}
PIDOG_MODEL_URL=${PIDOG_MODEL_URL:-https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf}
PIDOG_MODEL_SHA256=${PIDOG_MODEL_SHA256:-aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223}
PIDOG_VOICE_BASE=${PIDOG_VOICE_BASE:-https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium}

mkdir -p "$PIDOG_LLM_ROOT/models" "$PIDOG_LLM_ROOT/voices" \
  "$PIDOG_BIN_DIR" "$PIDOG_UNIT_DIR"

PIDOG_BUILD_ENV="$PIDOG_LLM_ROOT/build-venv"
if test ! -x "$PIDOG_BUILD_ENV/bin/cmake"; then
  python3 -m venv "$PIDOG_BUILD_ENV"
  "$PIDOG_BUILD_ENV/bin/pip" install --disable-pip-version-check 'cmake>=3.25,<5'
fi

PIDOG_SEARCH_ENV="$PIDOG_LLM_ROOT/search-venv"
if test ! -x "$PIDOG_SEARCH_ENV/bin/python"; then
  python3 -m venv "$PIDOG_SEARCH_ENV"
fi
"$PIDOG_SEARCH_ENV/bin/pip" install --disable-pip-version-check --upgrade ddgs

PIDOG_INSTALLED_REF=""
if test -f "$PIDOG_LLM_ROOT/llama.cpp-version"; then
  PIDOG_INSTALLED_REF=$(sed -n '1p' "$PIDOG_LLM_ROOT/llama.cpp-version")
fi
if test ! -x "$PIDOG_BIN_DIR/llama-server" || test "$PIDOG_INSTALLED_REF" != "$PIDOG_LLAMA_REF"; then
  PIDOG_BUILD_DIR=$(mktemp -d /tmp/pidog-llama-build.XXXXXX)
  case "$PIDOG_BUILD_DIR" in
    /tmp/pidog-llama-build.*) ;;
    *) echo "Unsafe build directory: $PIDOG_BUILD_DIR" >&2; exit 1 ;;
  esac
  trap 'rm -rf "$PIDOG_BUILD_DIR"' EXIT HUP INT TERM

  git clone --filter=blob:none --no-checkout https://github.com/ggml-org/llama.cpp.git \
    "$PIDOG_BUILD_DIR/llama.cpp"
  git -C "$PIDOG_BUILD_DIR/llama.cpp" checkout "$PIDOG_LLAMA_REF"
  "$PIDOG_BUILD_ENV/bin/cmake" -S "$PIDOG_BUILD_DIR/llama.cpp" \
    -B "$PIDOG_BUILD_DIR/llama.cpp/build" \
    -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON -DLLAMA_CURL=OFF -DBUILD_SHARED_LIBS=OFF
  "$PIDOG_BUILD_ENV/bin/cmake" --build "$PIDOG_BUILD_DIR/llama.cpp/build" \
    --config Release --target llama-server -j 4
  install -m 0755 "$PIDOG_BUILD_DIR/llama.cpp/build/bin/llama-server" \
    "$PIDOG_BIN_DIR/llama-server"
  printf '%s\n' "$PIDOG_LLAMA_REF" > "$PIDOG_LLM_ROOT/llama.cpp-version"
fi

PIDOG_MODEL="$PIDOG_LLM_ROOT/models/Qwen3.5-2B-Q4_K_M.gguf"
if test ! -f "$PIDOG_MODEL" || ! printf '%s  %s\n' "$PIDOG_MODEL_SHA256" "$PIDOG_MODEL" | sha256sum -c - >/dev/null 2>&1; then
  curl --fail --location --retry 4 --continue-at - \
    --output "$PIDOG_MODEL.part" "$PIDOG_MODEL_URL"
  printf '%s  %s\n' "$PIDOG_MODEL_SHA256" "$PIDOG_MODEL.part" | sha256sum -c -
  mv "$PIDOG_MODEL.part" "$PIDOG_MODEL"
fi

PIDOG_VOICE="$PIDOG_LLM_ROOT/voices/ru_RU-irina-medium.onnx"
PIDOG_VOICE_CONFIG="$PIDOG_VOICE.json"
curl --fail --location --retry 4 --output "$PIDOG_VOICE.part" \
  "$PIDOG_VOICE_BASE/ru_RU-irina-medium.onnx"
mv "$PIDOG_VOICE.part" "$PIDOG_VOICE"
curl --fail --location --retry 4 --output "$PIDOG_VOICE_CONFIG.part" \
  "$PIDOG_VOICE_BASE/ru_RU-irina-medium.onnx.json"
mv "$PIDOG_VOICE_CONFIG.part" "$PIDOG_VOICE_CONFIG"

install -m 0644 "$PIDOG_SCRIPT_DIR/pidog-llm.service" "$PIDOG_UNIT_DIR/pidog-llm.service"
systemctl --user daemon-reload
systemctl --user enable pidog-llm.service
# `enable --now` does not restart an already running service after its unit changes.
# Always restart so model/limits from the freshly installed unit take effect.
systemctl --user restart pidog-llm.service

PIDOG_ATTEMPT=0
while test "$PIDOG_ATTEMPT" -lt 60; do
  if curl --silent --fail http://127.0.0.1:8081/health >/dev/null; then
    echo "PiDog local LLM is ready"
    exit 0
  fi
  PIDOG_ATTEMPT=$((PIDOG_ATTEMPT + 1))
  sleep 1
done

systemctl --user --no-pager --full status pidog-llm.service || true
echo "PiDog local LLM did not become ready" >&2
exit 1
