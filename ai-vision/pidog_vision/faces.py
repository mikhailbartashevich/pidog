"""Persistent face embeddings and preview images."""

from __future__ import annotations

import base64
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from .database import initialize_face_database
from .errors import VisionError


class FaceRegistry:
    """OpenCV face embeddings and small enrolled-face pictures stored locally."""

    def __init__(self, database: Path, detector_model: Path, recognizer_model: Path) -> None:
        self._available = detector_model.is_file() and recognizer_model.is_file()
        self._lock = threading.Lock()
        self._database = database
        if not self._available:
            self._detector = self._recognizer = None
            return
        import cv2
        self._cv2 = cv2
        self._detector = cv2.FaceDetectorYN.create(str(detector_model), "", (640, 480), 0.82, 0.3, 5000)
        self._recognizer = cv2.FaceRecognizerSF.create(str(recognizer_model), "")
        initialize_face_database(database)

    @property
    def available(self) -> bool:
        return self._available

    def names(self) -> list[str]:
        if not self._available:
            return []
        with sqlite3.connect(self._database) as connection:
            return [row[0] for row in connection.execute("SELECT DISTINCT name FROM face ORDER BY name")]

    def delete(self, name: str) -> None:
        with sqlite3.connect(self._database) as connection:
            connection.execute("DELETE FROM face WHERE name = ?", (name,))

    def rename(self, old_name: str, new_name: str) -> bool:
        with sqlite3.connect(self._database) as connection:
            cursor = connection.execute(
                "UPDATE face SET name = ?, updated_at = ? WHERE name = ?",
                (new_name, int(time.time()), old_name),
            )
        return cursor.rowcount > 0

    def profiles(self) -> list[dict[str, Any]]:
        if not self._available:
            return []
        with sqlite3.connect(self._database) as connection:
            rows = connection.execute("SELECT name, image, updated_at FROM face ORDER BY name").fetchall()
        return [
            {
                "name": name,
                "image_jpeg": base64.b64encode(image).decode("ascii") if image else None,
                "updated_at": updated_at,
            }
            for name, image, updated_at in rows
        ]

    def _features(self, frame: Any) -> list[tuple[Any, Any]]:
        import numpy as np
        detector = self._detector
        detector.setInputSize((frame.shape[1], frame.shape[0]))
        _, faces = detector.detect(frame)
        if faces is None:
            return []
        results = []
        for face in faces:
            aligned = self._recognizer.alignCrop(frame, face)
            feature = self._recognizer.feature(aligned).astype(np.float32).reshape(-1)
            results.append((face, feature))
        return results

    def enroll(self, name: str, frame: Any) -> None:
        if not self._available:
            raise VisionError("face models are not installed")
        features = self._features(frame)
        if len(features) != 1:
            raise VisionError("show exactly one clear face while enrolling")
        import numpy as np
        face, feature = features[0]
        vector = np.asarray(feature, dtype=np.float32).tobytes()
        image = self._face_thumbnail(frame, face)
        with sqlite3.connect(self._database) as connection:
            connection.execute(
                "INSERT INTO face(name, embedding, image, updated_at) VALUES (?, ?, ?, ?)",
                (name, vector, image, int(time.time())),
            )

    def _face_thumbnail(self, frame: Any, face: Any) -> bytes:
        x, y, width, height = (float(value) for value in face[:4])
        padding = 0.30
        left, top = max(0, int(x - width * padding)), max(0, int(y - height * padding))
        right = min(frame.shape[1], int(x + width * (1 + padding)))
        bottom = min(frame.shape[0], int(y + height * (1 + padding)))
        return self._jpeg_thumbnail(frame[top:bottom, left:right])

    def _jpeg_thumbnail(self, image: Any) -> bytes:
        if image is None or image.size == 0:
            raise VisionError("selected face crop is empty")
        height, width = image.shape[:2]
        scale = min(1.0, 256 / max(width, height))
        if scale < 1:
            image = self._cv2.resize(image, (round(width * scale), round(height * scale)))
        encoded, jpeg = self._cv2.imencode(".jpg", image, [self._cv2.IMWRITE_JPEG_QUALITY, 82])
        if not encoded:
            raise VisionError("could not save face picture")
        return jpeg.tobytes()

    def recognize(self, frame: Any) -> list[dict[str, Any]]:
        if not self._available:
            return []
        import numpy as np
        with sqlite3.connect(self._database) as connection:
            known = [(name, np.frombuffer(blob, dtype=np.float32)) for name, blob in connection.execute(
                "SELECT name, embedding FROM face")]
        faces = []
        for face, vector in self._features(frame):
            matches: list[tuple[str, float]] = []
            for name, known_vector in known:
                score = float(self._recognizer.match(vector, known_vector, self._cv2.FaceRecognizerSF_FR_COSINE))
                if score >= 0.45:
                    matches.append((name, score))
            matches.sort(key=lambda item: (-item[1], item[0].casefold()))
            best_name = matches[0][0] if matches else None
            best_score = matches[0][1] if matches else 0.0
            close_names = list(dict.fromkeys(
                name for name, score in matches if score >= best_score - 0.03
            ))
            x, y, width, height = (float(value) for value in face[:4])
            faces.append({
                "name": best_name if best_score >= 0.45 else None,
                "names": close_names,
                "score": round(best_score, 3),
                "x": round(max(0.0, x) / frame.shape[1], 4),
                "y": round(max(0.0, y) / frame.shape[0], 4),
                "w": round(width / frame.shape[1], 4), "h": round(height / frame.shape[0], 4),
            })
        return faces
