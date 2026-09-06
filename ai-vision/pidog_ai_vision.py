#!/usr/bin/env python3
"""Entry point for the authenticated PiDog Pi 5 Hailo vision service."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from pidog_vision.detector import HailoDetector
from pidog_vision.errors import VisionError
from pidog_vision.faces import FaceRegistry
from pidog_vision.http_api import VisionService
from pidog_vision.objects import ObjectRegistry

__all__ = ["FaceRegistry", "HailoDetector", "ObjectRegistry", "VisionError", "main"]


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
    if not token:
        raise SystemExit("PIDOG_VISION_TOKEN is required")

    detector = HailoDetector(Path(args.hef), args.minimum_score)
    faces = FaceRegistry(Path(args.database), Path(args.face_detector), Path(args.face_recognizer))
    objects = ObjectRegistry(Path(args.object_database))
    service = VisionService((args.host, args.port), token, detector, faces, objects)
    try:
        service.serve_forever()
    finally:
        detector.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
