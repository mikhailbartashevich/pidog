"""Authenticated HTTP API for PiDog commands and sensor data."""

from __future__ import annotations

import hmac
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .audio import AudioUnavailableError
from .assistant import AssistantUnavailableError
from .constants import LOG, MAX_BODY_BYTES, SERVER_VERSION
from .controller import RobotController


class VoiceServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], controller: RobotController,
                 token: str) -> None:
        super().__init__(address, RequestHandler)
        self.controller = controller
        self.token = token


class RequestHandler(BaseHTTPRequestHandler):
    server: VoiceServer

    def do_GET(self) -> None:  # noqa: N802
        if not self._authorized():
            return
        if self.path == "/health":
            self._json(HTTPStatus.OK, {
                "ok": True, "service": "pidog-voice",
                "version": SERVER_VERSION,
                "dry_run": self.server.controller.dry_run,
                "audio": self.server.controller.audio_status,
                "local_voice": self.server.controller.local_voice_status,
                "assistant": self.server.controller.assistant_status,
                "commands": self.server.controller.commands,
            })
            return
        if self.path == "/sensors":
            try:
                sensors = self.server.controller.sensors()
            except Exception:
                LOG.exception("sensor snapshot failed")
                self._json(HTTPStatus.CONFLICT, {"ok": False, "error": "sensor read failed"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "message": "Датчики обновлены", **sensors})
            return
        if self.path == "/assistant/status":
            self._json(HTTPStatus.OK, {
                "ok": True, "assistant": self.server.controller.assistant_status,
            })
            return
        self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {
            "/command", "/assistant/control", "/assistant/chat", "/assistant/history",
        }:
            self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
            return
        if not self._authorized():
            return
        if "application/json" not in self.headers.get("Content-Type", ""):
            self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                       {"ok": False, "error": "Content-Type must be application/json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 2 or length > MAX_BODY_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                       {"ok": False, "error": "invalid body size"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid JSON"})
            return
        if not isinstance(payload, dict):
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "JSON object required"})
            return
        if self.path == "/assistant/control":
            self._assistant_control(payload)
            return
        if self.path == "/assistant/chat":
            self._assistant_chat(payload)
            return
        if self.path == "/assistant/history":
            if payload.get("action") != "clear":
                self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown action"})
                return
            self._json(HTTPStatus.OK, {
                "ok": True, **self.server.controller.assistant_clear_history(),
            })
            return

        command = payload.get("command")
        if not isinstance(command, str) or command not in self.server.controller.commands:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown command"})
            return
        phrase = payload.get("phrase", "")
        if isinstance(phrase, str):
            LOG.info("recognized_phrase=%r client=%s", phrase[:200], self.client_address[0])
        try:
            result = self.server.controller.execute(command)
        except AudioUnavailableError as error:
            LOG.error("PiDog audio command failed: %s: %s", command, error)
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "audio unavailable",
                "detail": str(error), "command": command,
            })
            return
        except Exception as error:
            LOG.exception("PiDog command failed: %s", command)
            detail = str(error).strip() or error.__class__.__name__
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "robot command failed",
                "detail": detail[:300], "command": command,
            })
            return
        self._json(HTTPStatus.ACCEPTED, {"ok": True, "command": command, **result})

    def _assistant_control(self, payload: dict[str, Any]) -> None:
        action = payload.get("action")
        if not isinstance(action, str) or action not in {"start", "stop", "restart"}:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown action"})
            return
        try:
            result = self.server.controller.assistant_control(action)
        except AssistantUnavailableError as error:
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "assistant unavailable", "detail": str(error),
            })
            return
        self._json(HTTPStatus.OK, {"ok": True, **result})

    def _assistant_chat(self, payload: dict[str, Any]) -> None:
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip() or len(message) > 600:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid message"})
            return
        search = payload.get("search")
        if search is not None and not isinstance(search, bool):
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid search flag"})
            return
        speak = payload.get("speak", False)
        if not isinstance(speak, bool):
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid speak flag"})
            return
        try:
            result = self.server.controller.assistant_chat(message, search, speak=speak)
        except AudioUnavailableError as error:
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "audio unavailable", "detail": str(error),
            })
            return
        except AssistantUnavailableError as error:
            self._json(HTTPStatus.CONFLICT, {
                "ok": False, "error": "assistant unavailable", "detail": str(error),
            })
            return
        self._json(HTTPStatus.OK, {"ok": True, **result})

    def _authorized(self) -> bool:
        expected = self.server.token
        supplied = self.headers.get("X-PiDog-Token", "")
        if expected and not hmac.compare_digest(supplied, expected):
            self._json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "unauthorized"})
            return False
        return True

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: Any) -> None:
        LOG.info("client=%s %s", self.client_address[0], format_string % args)
