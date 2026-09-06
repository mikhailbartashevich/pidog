#!/usr/bin/env python3
"""Backward-compatible test runner for the canonical common test suite."""

import runpy
from pathlib import Path


if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).resolve().parent / "common" / "test_pidog_voice_server.py"),
        run_name="__main__",
    )
