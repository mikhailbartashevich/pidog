# PiDog Raspberry Pi setup V4

This is a snapshot of the Raspberry Pi setup captured while preparing the new AI HAT+ 2 configuration. V4 preserves the original systemd files, environment settings, and local CPU `llama.cpp` installer. The shared CPU runtime and the single entry point are in the parent directory: `../common/` and `../pidog_voice_server.py`; the shared test suite is `../test_pidog_voice_server.py`.

For the new Raspberry Pi 5 + AI HAT+ 2 board, use the sibling directory `../AI_HAT_2/`.
