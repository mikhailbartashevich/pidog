"""Authenticated HTTP API for PiDog AI Vision."""

from __future__ import annotations

import hmac
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from .constants import MAX_IMAGE_BYTES, NAME_PATTERN
from .detector import HailoDetector
from .errors import VisionError
from .faces import FaceRegistry
from .objects import ObjectRegistry


class VisionService(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], token: str, detector: HailoDetector,
                 faces: FaceRegistry, objects: ObjectRegistry) -> None:
        super().__init__(address, Handler)
        self.token, self.detector, self.faces, self.objects = token, detector, faces, objects


class Handler(BaseHTTPRequestHandler):
    server: VisionService

    def do_GET(self) -> None:  # noqa: N802
        if self.path in {"/admin", "/admin/"}:
            self._admin_page()
            return
        if not self._authorized():
            return
        if self.path == "/health":
            self._json(200, {
                "ok": True,
                "backend": "hailo-apps-yolov8m-h10",
                "faces": {"ready": self.server.faces.available, "names": self.server.faces.names()},
                "objects": {"names": self.server.objects.names()},
            })
        elif self.path == "/faces":
            self._json(200, {"ok": True, "names": self.server.faces.names()})
        elif self.path == "/objects":
            self._json(200, {"ok": True, "names": self.server.objects.names()})
        elif self.path == "/guard-targets":
            targets = [
                {"name": name, "source": "face"}
                for name in self.server.faces.names()
            ] + [
                {"name": name, "source": "object"}
                for name in self.server.objects.person_names()
            ]
            self._json(200, {"ok": True, "targets": targets})
        elif self.path == "/memory":
            self._json(200, {
                "ok": True,
                "faces": [
                    {**profile, "source": "face"}
                    for profile in self.server.faces.profiles()
                ],
                "people": self.server.objects.person_profiles(),
                "objects": self.server.objects.profiles(),
            })
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        if not self._authorized():
            return
        if self.path.startswith("/objects/") and self.path.endswith("/role"):
            name = self._object_role_name()
            payload = self._json_body()
            role = payload.get("role") if payload else None
            if name is None or role not in {"person", "object"}:
                if name is not None:
                    self._json(400, {"ok": False, "error": "invalid object role"})
                return
            if role == "person":
                found = self.server.objects.mark_as_person(name)
            else:
                self.server.objects.unmark_as_person(name)
                found = True
            if found:
                self._json(200, {"ok": True, "name": name, "role": role})
            else:
                self._json(404, {"ok": False, "error": "memory entry not found"})
            return
        if not (self.path.startswith("/faces/") or self.path.startswith("/objects/")):
            self._json(404, {"ok": False, "error": "not found"})
            return
        payload = self._json_body()
        new_name = payload.get("name") if payload else None
        if not isinstance(new_name, str) or not NAME_PATTERN.fullmatch(new_name):
            self._json(400, {"ok": False, "error": "invalid new name"})
            return
        if self.path.startswith("/faces/"):
            old_name = self._face_name()
            found = old_name is not None and self.server.faces.rename(old_name, new_name)
        else:
            old_name = self._object_name()
            found = old_name is not None and self.server.objects.rename(old_name, new_name)
        if found:
            self._json(200, {"ok": True, "name": new_name})
        elif old_name is not None:
            self._json(404, {"ok": False, "error": "memory entry not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._authorized():
            return
        image = self._image()
        if image is None:
            return
        if self.path == "/infer":
            try:
                objects = self.server.objects.annotate(image, self.server.detector.detect(image))
                self._json(200, {"ok": True, "objects": objects, "faces": self.server.faces.recognize(image)})
            except Exception as error:
                self._json(503, {"ok": False, "error": str(error)[:200]})
            return
        if self.path.startswith("/faces/"):
            name = self._face_name()
            if name is None:
                return
            try:
                self.server.faces.enroll(name, image)
                self._json(201, {"ok": True, "name": name, "names": [name]})
            except VisionError as error:
                self._json(409, {"ok": False, "error": str(error)})
            return
        if self.path.startswith("/objects/"):
            name = self._object_name()
            if name is None:
                return
            try:
                self.server.objects.enroll(name, image)
                self._json(201, {"ok": True, "name": name})
            except VisionError as error:
                self._json(409, {"ok": False, "error": str(error)})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        if not self._authorized():
            return
        if self.path.startswith("/objects/"):
            name = self._object_name()
            if name is not None:
                self.server.objects.delete(name)
                self._json(200, {"ok": True, "name": name})
            return
        if not self.path.startswith("/faces/"):
            self._json(404, {"ok": False, "error": "not found"})
            return
        name = self._face_name()
        if name is not None:
            self.server.faces.delete(name)
            self._json(200, {"ok": True, "name": name})

    def _image(self) -> Any | None:
        if "image/jpeg" not in self.headers.get("Content-Type", ""):
            self._json(415, {"ok": False, "error": "image/jpeg required"})
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_IMAGE_BYTES:
            self._json(413, {"ok": False, "error": "invalid image size"})
            return None
        import cv2
        import numpy as np
        image = cv2.imdecode(np.frombuffer(self.rfile.read(length), dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            self._json(400, {"ok": False, "error": "invalid JPEG"})
        return image

    def _json_body(self) -> dict[str, Any] | None:
        if "application/json" not in self.headers.get("Content-Type", ""):
            self._json(415, {"ok": False, "error": "application/json required"})
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 2 <= length <= 16 * 1024:
            self._json(413, {"ok": False, "error": "invalid JSON size"})
            return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON"})
            return None
        if not isinstance(value, dict):
            self._json(400, {"ok": False, "error": "JSON object required"})
            return None
        return value

    def _admin_page(self) -> None:
        page = Path(__file__).parents[1] / "admin.html"
        try:
            body = page.read_bytes()
        except OSError:
            self._json(404, {"ok": False, "error": "admin UI is not installed"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _face_name(self) -> str | None:
        return self._name("/faces/", "face")

    def _object_name(self) -> str | None:
        return self._name("/objects/", "object")

    def _object_role_name(self) -> str | None:
        name = unquote(self.path.removeprefix("/objects/").removesuffix("/role").rstrip("/"))
        if not NAME_PATTERN.fullmatch(name):
            self._json(400, {"ok": False, "error": "invalid object name"})
            return None
        return name

    def _name(self, prefix: str, kind: str) -> str | None:
        name = unquote(self.path.removeprefix(prefix))
        if not NAME_PATTERN.fullmatch(name):
            self._json(400, {"ok": False, "error": f"invalid {kind} name"})
            return None
        return name

    def _authorized(self) -> bool:
        supplied = self.headers.get("X-PiDog-Vision-Token", "")
        if not self.server.token or not hmac.compare_digest(supplied, self.server.token):
            self._json(401, {"ok": False, "error": "unauthorized"})
            return False
        return True

    def _json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return
