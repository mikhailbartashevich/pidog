"""Hailo object-detection adapter."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from .constants import COCO_LABELS
from .errors import VisionError


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
        self._cv2, self._np, self._minimum_score = cv2, np, minimum_score
        self._lock = threading.Lock()
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
                if right > left and bottom > top:
                    detections.append({
                        "label": COCO_LABELS[class_id], "score": round(float(score), 3),
                        "x": round(left / width, 4), "y": round(top / height, 4),
                        "w": round((right - left) / width, 4),
                        "h": round((bottom - top) / height, 4),
                    })
        return sorted(detections, key=lambda item: item["score"], reverse=True)
