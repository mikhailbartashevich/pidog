"""Command-line entry point for the PiDog voice service."""

from __future__ import annotations

import argparse
import logging
import os
import signal
import threading
from typing import Any

from .constants import LOG
from .controller import RobotController
from .http_api import VoiceServer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PiDog V2 Russian voice command bridge")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--token", default=os.environ.get("PIDOG_TOKEN", ""))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if not 1 <= args.port <= 65535:
        raise SystemExit("--port must be between 1 and 65535")
    controller = RobotController(dry_run=args.dry_run)
    server = VoiceServer((args.host, args.port), controller, args.token)

    def request_shutdown(_signal: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)
    LOG.info("PiDog server listening on http://%s:%d token=%s dry_run=%s",
             args.host, args.port, "enabled" if args.token else "disabled", args.dry_run)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
        controller.close()
        LOG.info("PiDog server stopped")
    return 0

