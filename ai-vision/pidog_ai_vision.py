#!/usr/bin/env python3
"""Authenticated Pi 5 Hailo object detection and named-face service.

PiDog posts JPEG frames to this service. Motors never receive network commands:
only PiDog decides how to react to the returned, normalized bounding boxes.
"""

from __future__ import annotations

import argparse
import base64
import hmac
import json
import os
import re
import sqlite3
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote


MAX_IMAGE_BYTES = 3 * 1024 * 1024
COCO_LABELS = (
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
    "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant",
    "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard",
    "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book",
    "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
)
NAME_PATTERN = re.compile(r"^[\w .'-]{1,48}$", re.UNICODE)


class VisionError(RuntimeError):
    pass


class HailoDetector:
    """A serialized Hailo Apps inference pipeline for the Pi 5 AI HAT+ 2."""

    def __init__(self, hef_path: Path, minimum_score: float) -> None:
        import cv2
        import numpy as np
        try:
            from hailo_apps.python.core.common.hailo_inference import HailoInfer
        except ImportError as error:
            raise VisionError(
                "Hailo Apps is not installed; run the Pi 5 Hailo Apps installer first"
            ) from error

        if not hef_path.is_file():
            raise VisionError(f"Hailo model is missing: {hef_path}")
        self._cv2 = cv2
        self._np = np
        self._minimum_score = minimum_score
        self._lock = threading.Lock()
        # HailoInfer is Hailo's current shared-VDevice wrapper. It selects the
        # compatible scheduler path for HailoRT 5.1.1/Hailo-10H, which is why
        # it is used instead of manually configuring a legacy VStream group.
        self._infer = HailoInfer(str(hef_path), output_type="FLOAT32")
        shape = self._infer.get_input_shape()
        if len(shape) != 3:
            self.close()
            raise VisionError(f"unexpected Hailo model input shape: {shape}")
        self._input_height, self._input_width = int(shape[0]), int(shape[1])

    def close(self) -> None:
        self._infer.close()

    def detect(self, bgr: Any) -> list[dict[str, Any]]:
        height, width = bgr.shape[:2]
        scale = min(self._input_width / width, self._input_height / height)
        resized = self._cv2.resize(bgr, (round(width * scale), round(height * scale)))
        canvas = self._np.full((self._input_height, self._input_width, 3), 114, dtype=self._np.uint8)
        pad_x = (self._input_width - resized.shape[1]) // 2
        pad_y = (self._input_height - resized.shape[0]) // 2
        canvas[pad_y:pad_y + resized.shape[0], pad_x:pad_x + resized.shape[1]] = resized
        rgb = self._cv2.cvtColor(canvas, self._cv2.COLOR_BGR2RGB)
        outputs: dict[str, Any] = {}
        callback_error: list[Exception] = []

        def complete(completion_info: Any, bindings_list: list[Any]) -> None:
            # HailoRT invokes this callback from native code: never allow an
            # exception to escape it, because that would terminate the daemon.
            del completion_info
            try:
                for name in self._infer.output_type:
                    outputs[name] = bindings_list[0].output(name).get_buffer()
            except Exception as error:  # pragma: no cover - hardware callback
                callback_error.append(error)

        with self._lock:
            job = self._infer.run([rgb], complete)
            job.wait(10_000)
        if callback_error:
            raise VisionError(f"Hailo output read failed: {callback_error[0]}")
        if not outputs:
            raise VisionError("Hailo inference returned no outputs")
        classes = next(iter(outputs.values()))
        if not isinstance(classes, (list, tuple)):
            raise VisionError("unexpected Hailo NMS output")
        detections: list[dict[str, Any]] = []
        for class_id, boxes in enumerate(classes):
            if class_id >= len(COCO_LABELS):
                break
            for y_min, x_min, y_max, x_max, score in boxes:
                if float(score) < self._minimum_score:
                    continue
                left = max(0.0, min(width, (float(x_min) * self._input_width - pad_x) / scale))
                top = max(0.0, min(height, (float(y_min) * self._input_height - pad_y) / scale))
                right = max(0.0, min(width, (float(x_max) * self._input_width - pad_x) / scale))
                bottom = max(0.0, min(height, (float(y_max) * self._input_height - pad_y) / scale))
                if right <= left or bottom <= top:
                    continue
                detections.append({
                    "label": COCO_LABELS[class_id], "score": round(float(score), 3),
                    "x": round(left / width, 4), "y": round(top / height, 4),
                    "w": round((right - left) / width, 4),
                    "h": round((bottom - top) / height, 4),
                })
        return sorted(detections, key=lambda item: item["score"], reverse=True)


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
        database.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(database) as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS face "
                "(name TEXT NOT NULL, embedding BLOB NOT NULL, image BLOB, updated_at INTEGER)"
            )
            self._add_column_if_missing(connection, "face", "image", "BLOB")
            self._add_column_if_missing(connection, "face", "updated_at", "INTEGER")

    @staticmethod
    def _add_column_if_missing(connection: sqlite3.Connection, table: str,
                               column: str, declaration: str) -> None:
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {declaration}")

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
            connection.execute("DELETE FROM face WHERE name = ?", (new_name,))
            cursor = connection.execute(
                "UPDATE face SET name = ?, updated_at = ? WHERE name = ?",
                (new_name, int(time.time()), old_name),
            )
        return cursor.rowcount > 0

    def profiles(self) -> list[dict[str, Any]]:
        if not self._available:
            return []
        with sqlite3.connect(self._database) as connection:
            rows = connection.execute(
                "SELECT name, image, updated_at FROM face ORDER BY name"
            ).fetchall()
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
            connection.execute("DELETE FROM face WHERE name = ?", (name,))
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
            x, y, width, height = (float(value) for value in face[:4])
            faces.append({
                "name": best_name if best_score >= 0.45 else None,
                "names": [name for name, score in matches if score >= best_score - 0.03],
                "score": round(best_score, 3),
                "x": round(max(0.0, x) / frame.shape[1], 4),
                "y": round(max(0.0, y) / frame.shape[0], 4),
                "w": round(width / frame.shape[1], 4), "h": round(height / frame.shape[0], 4),
            })
        return faces


class ObjectRegistry:
    """Small local visual memory for a user-named detected object.

    This deliberately does not claim to retrain the Hailo COCO detector. It
    stores a compact colour/shape descriptor for a selected crop and adds the
    user's name when the same-looking detected object appears again.
    """

    def __init__(self, database: Path) -> None:
        import cv2
        self._cv2 = cv2
        self._database = database
        self._lock = threading.Lock()
        database.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(database) as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS object_memory "
                "(name TEXT NOT NULL, feature BLOB NOT NULL, image BLOB, updated_at INTEGER)"
            )
            FaceRegistry._add_column_if_missing(connection, "object_memory", "image", "BLOB")
            FaceRegistry._add_column_if_missing(connection, "object_memory", "updated_at", "INTEGER")

    def names(self) -> list[str]:
        with sqlite3.connect(self._database) as connection:
            return [row[0] for row in connection.execute(
                "SELECT DISTINCT name FROM object_memory ORDER BY name"
            )]

    def delete(self, name: str) -> None:
        with sqlite3.connect(self._database) as connection:
            connection.execute("DELETE FROM object_memory WHERE name = ?", (name,))

    def rename(self, old_name: str, new_name: str) -> bool:
        with sqlite3.connect(self._database) as connection:
            connection.execute("DELETE FROM object_memory WHERE name = ?", (new_name,))
            cursor = connection.execute(
                "UPDATE object_memory SET name = ?, updated_at = ? WHERE name = ?",
                (new_name, int(time.time()), old_name),
            )
        return cursor.rowcount > 0

    def profiles(self) -> list[dict[str, Any]]:
        with sqlite3.connect(self._database) as connection:
            rows = connection.execute(
                "SELECT name, image, updated_at FROM object_memory ORDER BY name"
            ).fetchall()
        return [
            {
                "name": name,
                "image_jpeg": base64.b64encode(image).decode("ascii") if image else None,
                "updated_at": updated_at,
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
            connection.execute("DELETE FROM object_memory WHERE name = ?", (name,))
            connection.execute(
                "INSERT INTO object_memory(name, feature, image, updated_at) VALUES (?, ?, ?, ?)",
                (name, feature.tobytes(), picture, int(time.time())),
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
            # A repeated view changes with lighting and camera distance. 0.72
            # accepts a deliberately saved object while still rejecting most
            # unrelated colour/shape combinations.
            if best_name is not None and best_score >= 0.72:
                detection["name"] = best_name
                detection["memory_score"] = round(best_score, 3)
        return detections


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
        if not self._authorized(): return
        if self.path == "/health":
            self._json(200, {"ok": True, "backend": "hailo-apps-yolov8m-h10", "faces": {"ready": self.server.faces.available, "names": self.server.faces.names()}, "objects": {"names": self.server.objects.names()}})
        elif self.path == "/faces": self._json(200, {"ok": True, "names": self.server.faces.names()})
        elif self.path == "/objects": self._json(200, {"ok": True, "names": self.server.objects.names()})
        elif self.path == "/memory":
            self._json(200, {"ok": True, "faces": self.server.faces.profiles(), "objects": self.server.objects.profiles()})
        else: self._json(404, {"ok": False, "error": "not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        if not self._authorized(): return
        if not (self.path.startswith("/faces/") or self.path.startswith("/objects/")):
            self._json(404, {"ok": False, "error": "not found"}); return
        payload = self._json_body()
        new_name = payload.get("name") if payload else None
        if not isinstance(new_name, str) or not NAME_PATTERN.fullmatch(new_name):
            self._json(400, {"ok": False, "error": "invalid new name"}); return
        if self.path.startswith("/faces/"):
            old_name = self._name()
            found = old_name is not None and self.server.faces.rename(old_name, new_name)
        else:
            old_name = self._object_name()
            found = old_name is not None and self.server.objects.rename(old_name, new_name)
        if found:
            self._json(200, {"ok": True, "name": new_name})
        elif old_name is not None:
            self._json(404, {"ok": False, "error": "memory entry not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._authorized(): return
        image = self._image()
        if image is None: return
        if self.path == "/infer":
            try:
                objects = self.server.objects.annotate(image, self.server.detector.detect(image))
                self._json(200, {"ok": True, "objects": objects, "faces": self.server.faces.recognize(image)})
            except Exception as error: self._json(503, {"ok": False, "error": str(error)[:200]})
            return
        if self.path.startswith("/faces/"):
            name = self._name()
            if name is None: return
            try:
                self.server.faces.enroll(name, image)
                self._json(201, {"ok": True, "name": name, "names": [name]})
            except VisionError as error: self._json(409, {"ok": False, "error": str(error)})
            return
        if self.path.startswith("/objects/"):
            name = self._object_name()
            if name is None: return
            try:
                self.server.objects.enroll(name, image)
                self._json(201, {"ok": True, "name": name})
            except VisionError as error: self._json(409, {"ok": False, "error": str(error)})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        if not self._authorized(): return
        if self.path.startswith("/objects/"):
            name = self._object_name()
            if name is not None:
                self.server.objects.delete(name); self._json(200, {"ok": True, "name": name})
            return
        if not self.path.startswith("/faces/"):
            self._json(404, {"ok": False, "error": "not found"}); return
        name = self._name()
        if name is not None:
            self.server.faces.delete(name); self._json(200, {"ok": True, "name": name})

    def _image(self) -> Any | None:
        if "image/jpeg" not in self.headers.get("Content-Type", ""):
            self._json(415, {"ok": False, "error": "image/jpeg required"}); return None
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if not 0 < length <= MAX_IMAGE_BYTES:
            self._json(413, {"ok": False, "error": "invalid image size"}); return None
        import cv2, numpy as np
        image = cv2.imdecode(np.frombuffer(self.rfile.read(length), dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None: self._json(400, {"ok": False, "error": "invalid JPEG"})
        return image

    def _json_body(self) -> dict[str, Any] | None:
        if "application/json" not in self.headers.get("Content-Type", ""):
            self._json(415, {"ok": False, "error": "application/json required"}); return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 2 <= length <= 16 * 1024:
            self._json(413, {"ok": False, "error": "invalid JSON size"}); return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON"}); return None
        if not isinstance(value, dict):
            self._json(400, {"ok": False, "error": "JSON object required"}); return None
        return value

    def _admin_page(self) -> None:
        page = Path(__file__).with_name("admin.html")
        try:
            body = page.read_bytes()
        except OSError:
            self._json(404, {"ok": False, "error": "admin UI is not installed"}); return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _name(self) -> str | None:
        name = unquote(self.path.removeprefix("/faces/"))
        if not NAME_PATTERN.fullmatch(name):
            self._json(400, {"ok": False, "error": "invalid face name"}); return None
        return name

    def _object_name(self) -> str | None:
        name = unquote(self.path.removeprefix("/objects/"))
        if not NAME_PATTERN.fullmatch(name):
            self._json(400, {"ok": False, "error": "invalid object name"}); return None
        return name

    def _authorized(self) -> bool:
        supplied = self.headers.get("X-PiDog-Vision-Token", "")
        if not self.server.token or not hmac.compare_digest(supplied, self.server.token):
            self._json(401, {"ok": False, "error": "unauthorized"}); return False
        return True

    def _json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--hef", default="/usr/local/hailo/resources/models/hailo10h/yolov8m.hef")
    parser.add_argument("--face-detector", default="/opt/pidog-ai-vision/models/face_detection_yunet_2023mar.onnx")
    parser.add_argument("--face-recognizer", default="/opt/pidog-ai-vision/models/face_recognition_sface_2021dec.onnx")
    parser.add_argument("--database", default="/var/lib/pidog-ai-vision/faces.sqlite3")
    parser.add_argument("--object-database", default="/var/lib/pidog-ai-vision/objects.sqlite3")
    parser.add_argument("--minimum-score", type=float, default=0.30)
    args = parser.parse_args()
    token = os.environ.get("PIDOG_VISION_TOKEN", "")
    if not token: raise SystemExit("PIDOG_VISION_TOKEN is required")
    detector = HailoDetector(Path(args.hef), args.minimum_score)
    faces = FaceRegistry(Path(args.database), Path(args.face_detector), Path(args.face_recognizer))
    objects = ObjectRegistry(Path(args.object_database))
    service = VisionService((args.host, args.port), token, detector, faces, objects)
    try: service.serve_forever()
    finally: detector.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
