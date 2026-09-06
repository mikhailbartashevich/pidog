"""Persistent visual memory for user-named detected objects."""

from __future__ import annotations

import base64
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from .database import initialize_object_database
from .errors import VisionError


class ObjectRegistry:
    """Store colour and shape descriptors without retraining the Hailo detector."""

    def __init__(self, database: Path) -> None:
        import cv2
        self._cv2 = cv2
        self._database = database
        self._lock = threading.Lock()
        initialize_object_database(database)

    def names(self) -> list[str]:
        with sqlite3.connect(self._database) as connection:
            return [row[0] for row in connection.execute(
                "SELECT DISTINCT name FROM object_memory ORDER BY name"
            )]

    def person_names(self) -> list[str]:
        """Named visual targets intentionally shown with people in guard mode."""
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            return [row[0] for row in connection.execute(
                "SELECT name FROM guard_person ORDER BY name"
            )]

    def mark_as_person(self, name: str) -> bool:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            exists = connection.execute(
                "SELECT 1 FROM object_memory WHERE name = ? LIMIT 1", (name,)
            ).fetchone()
            if not exists:
                return False
            connection.execute("INSERT OR IGNORE INTO guard_person(name) VALUES (?)", (name,))
        return True

    def unmark_as_person(self, name: str) -> None:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            connection.execute("DELETE FROM guard_person WHERE name = ?", (name,))

    def delete(self, name: str) -> None:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            connection.execute("DELETE FROM object_memory WHERE name = ?", (name,))
            connection.execute("DELETE FROM guard_person WHERE name = ?", (name,))

    def rename(self, old_name: str, new_name: str) -> bool:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            was_person = connection.execute(
                "SELECT 1 FROM guard_person WHERE name = ?", (old_name,)
            ).fetchone()
            cursor = connection.execute(
                "UPDATE object_memory SET name = ?, updated_at = ? WHERE name = ?",
                (new_name, int(time.time()), old_name),
            )
            if was_person:
                connection.execute("DELETE FROM guard_person WHERE name = ?", (old_name,))
                connection.execute("INSERT OR IGNORE INTO guard_person(name) VALUES (?)", (new_name,))
        return cursor.rowcount > 0

    def profiles(self) -> list[dict[str, Any]]:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            rows = connection.execute(
                "SELECT name, image, updated_at FROM object_memory "
                "WHERE name NOT IN (SELECT name FROM guard_person) ORDER BY name"
            ).fetchall()
        return [
            {
                "name": name,
                "image_jpeg": base64.b64encode(image).decode("ascii") if image else None,
                "updated_at": updated_at,
            }
            for name, image, updated_at in rows
        ]

    def person_profiles(self) -> list[dict[str, Any]]:
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            rows = connection.execute(
                "SELECT name, image, updated_at FROM object_memory "
                "WHERE name IN (SELECT name FROM guard_person) ORDER BY name"
            ).fetchall()
        return [
            {
                "name": name,
                "image_jpeg": base64.b64encode(image).decode("ascii") if image else None,
                "updated_at": updated_at,
                "source": "object",
            }
            for name, image, updated_at in rows
        ]

    def _feature(self, image: Any) -> Any:
        import numpy as np
        if image is None or image.size == 0:
            raise VisionError("selected object crop is empty")
        thumbnail = self._cv2.resize(image, (96, 96), interpolation=self._cv2.INTER_AREA)
        hsv = self._cv2.cvtColor(thumbnail, self._cv2.COLOR_BGR2HSV)
        histogram = self._cv2.calcHist([hsv], [0, 1, 2], None, [12, 12, 6], [0, 180, 0, 256, 0, 256])
        return self._cv2.normalize(histogram, None).astype(np.float32).reshape(-1)

    def enroll(self, name: str, image: Any) -> None:
        feature = self._feature(image)
        picture = self._jpeg_thumbnail(image)
        with sqlite3.connect(self._database) as connection:
            self._ensure_guard_table(connection)
            connection.execute(
                "INSERT INTO object_memory(name, feature, image, updated_at) VALUES (?, ?, ?, ?)",
                (name, feature.tobytes(), picture, int(time.time())),
            )
            if "cat" in name.casefold() or "кот" in name.casefold():
                connection.execute("INSERT OR IGNORE INTO guard_person(name) VALUES (?)", (name,))

    @staticmethod
    def _ensure_guard_table(connection: sqlite3.Connection) -> None:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS guard_person "
            "(name TEXT NOT NULL PRIMARY KEY)"
        )

    def _jpeg_thumbnail(self, image: Any) -> bytes:
        height, width = image.shape[:2]
        scale = min(1.0, 256 / max(width, height))
        if scale < 1:
            image = self._cv2.resize(image, (round(width * scale), round(height * scale)))
        encoded, jpeg = self._cv2.imencode(".jpg", image, [self._cv2.IMWRITE_JPEG_QUALITY, 82])
        if not encoded:
            raise VisionError("could not save object picture")
        return jpeg.tobytes()

    def annotate(self, frame: Any, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        import numpy as np
        with sqlite3.connect(self._database) as connection:
            known = [(name, np.frombuffer(blob, dtype=np.float32)) for name, blob in connection.execute(
                "SELECT name, feature FROM object_memory"
            )]
        if not known:
            return detections
        height, width = frame.shape[:2]
        for detection in detections:
            left = max(0, int(float(detection["x"]) * width))
            top = max(0, int(float(detection["y"]) * height))
            right = min(width, int((float(detection["x"]) + float(detection["w"])) * width))
            bottom = min(height, int((float(detection["y"]) + float(detection["h"])) * height))
            try:
                feature = self._feature(frame[top:bottom, left:right])
            except VisionError:
                continue
            best_name, best_score = None, -1.0
            for name, known_feature in known:
                score = float(self._cv2.compareHist(feature, known_feature, self._cv2.HISTCMP_CORREL))
                if score > best_score:
                    best_name, best_score = name, score
            if best_name is not None and best_score >= 0.72:
                detection["name"] = best_name
                detection["memory_score"] = round(best_score, 3)
        return detections
