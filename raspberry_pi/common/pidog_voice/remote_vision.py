"""Client for the separately hosted Pi 5 vision service."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class RemoteVisionError(RuntimeError):
    pass


class RemoteVisionClient:
    def __init__(self) -> None:
        self._url = os.environ.get("PIDOG_VISION_URL", "").rstrip("/")
        self._token = os.environ.get("PIDOG_VISION_TOKEN", "")
        self._timeout = float(os.environ.get("PIDOG_VISION_TIMEOUT", "2.5"))

    @property
    def status(self) -> dict[str, Any]:
        return {"configured": bool(self._url and self._token), "url": self._url or None}

    def infer(self, frame: Any) -> dict[str, list[dict[str, Any]]]:
        payload = self._post_jpeg("/infer", frame)
        return {"objects": self._items(payload.get("objects")), "faces": self._items(payload.get("faces"))}

    def enroll(self, name: str, frame: Any) -> dict[str, Any]:
        """Store one already-selected face crop under ``name`` on the AI Pi."""
        return self._post_jpeg(f"/faces/{quote(name, safe='')}", frame)

    def enroll_object(self, name: str, frame: Any) -> dict[str, Any]:
        """Store one user-selected object crop as local visual memory on the AI Pi."""
        return self._post_jpeg(f"/objects/{quote(name, safe='')}", frame)

    def _post_jpeg(self, path: str, frame: Any) -> dict[str, Any]:
        if not self._url or not self._token:
            raise RemoteVisionError("remote vision is not configured")
        try:
            import cv2
            encoded, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
        except Exception as error:
            raise RemoteVisionError(f"could not encode camera frame: {error}") from error
        if not encoded:
            raise RemoteVisionError("could not encode camera frame")
        request = Request(f"{self._url}{path}", data=jpeg.tobytes(), method="POST", headers={
            "Content-Type": "image/jpeg", "X-PiDog-Vision-Token": self._token,
        })
        try:
            with urlopen(request, timeout=self._timeout) as response:
                payload = json.loads(response.read(256 * 1024).decode("utf-8"))
        except (OSError, URLError, ValueError) as error:
            raise RemoteVisionError(f"remote vision unavailable: {error}") from error
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            raise RemoteVisionError("remote vision returned an invalid response")
        return payload

    @staticmethod
    def _items(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]
