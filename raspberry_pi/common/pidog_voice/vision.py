"""Lighting, camera, and color-search behavior."""

from __future__ import annotations

import time
import threading
from pathlib import Path
from typing import Any

from .constants import LOG


class VisionMixin:
    def _set_light(self, style: str, color: str, bps: float = 1,
                   brightness: float = 1) -> None:
        self._dog.rgb_strip.set_mode(style=style, color=color, bps=bps, brightness=brightness)

    def _light_command(self, color: str) -> dict[str, Any]:
        self._set_light("breath", color, bps=1.2, brightness=1)
        return {"message": "Подсветка переливается выбранным цветом"}

    def _light_blink(self) -> dict[str, Any]:
        self._set_light("boom", "white", bps=3, brightness=1)
        return {"message": "Подсветка мигает"}

    def _light_off(self) -> dict[str, Any]:
        self._set_light("breath", "#000000", bps=1, brightness=0)
        return {"message": "Подсветка выключена"}

    def _camera_on(self) -> dict[str, Any]:
        self._ensure_camera()
        return {"message": "Камера включена", "camera_url": "http://ROBOT:9000/mjpg"}

    def _camera_off(self) -> dict[str, Any]:
        self._close_camera()
        return {"message": "Камера выключена"}

    def _ensure_camera(self) -> None:
        if self._camera_started:
            return
        from vilib import Vilib

        self._vilib = Vilib
        Vilib.camera_start(vflip=False, hflip=False)
        Vilib.display(local=False, web=True)
        time.sleep(1.5)
        self._camera_started = True

    def _close_camera(self) -> None:
        if not self._camera_started or self._vilib is None:
            return
        try:
            self._vilib.close_color_detection()
        except Exception:
            LOG.debug("could not stop color detection", exc_info=True)
        try:
            self._set_face_detection(False)
        except Exception:
            LOG.debug("could not stop face detection", exc_info=True)
        try:
            self._vilib.camera_close()
        except Exception:
            LOG.debug("could not close camera", exc_info=True)
        self._camera_started = False
        self._vilib = None

    def _find_color(self, color: str) -> dict[str, Any]:
        """Scan for a confirmed color, point with a paw and bark when found."""
        self._ensure_camera()
        try:
            self._set_face_detection(False)
        except Exception:
            LOG.debug("could not pause face detection for color search", exc_info=True)
        self._vilib.color_detect(color=color)
        found: dict[str, float] | None = None
        for scan_yaw in (-40, 0, 40):
            self._dog.head_move([[scan_yaw, 0, 0]], immediately=True, speed=60)
            time.sleep(0.7)
            confirmations = 0
            deadline = time.monotonic() + 2.2
            while time.monotonic() < deadline:
                parameters = dict(self._vilib.detect_obj_parameter)
                count = int(parameters.get("color_n", 0) or 0)
                width = float(parameters.get("color_w", 0) or 0)
                height = float(parameters.get("color_h", 0) or 0)
                if count > 0 and width >= 12 and height >= 12:
                    confirmations += 1
                    found = {
                        "x": float(parameters.get("color_x", 160) or 160),
                        "y": float(parameters.get("color_y", 120) or 120),
                        "w": width, "h": height, "scan_yaw": float(scan_yaw),
                    }
                    if confirmations >= 2:
                        break
                else:
                    confirmations = 0
                time.sleep(0.18)
            if confirmations >= 2:
                break

        if found is None:
            self._dog.head_move([[0, 0, 0]], immediately=True, speed=55)
            self._dog.do_action("shake_head", speed=70)
            return {
                "found": False, "color": color,
                "message": f"Цвет {self._russian_color(color)} не найден — Пайдог показывает «нет»",
            }

        yaw = self._clamp(found["scan_yaw"] + (160 - found["x"]) * 0.30, -70, 70)
        pitch = self._clamp((120 - found["y"]) * 0.22, -25, 25)
        position = "center"
        if yaw < -12:
            position = "right"
        elif yaw > 12:
            position = "left"

        # Negative head yaw is right on PiDog. Turn the legs until the camera
        # points approximately forward, then center the head.
        if position != "center":
            turn = "turn_right" if position == "right" else "turn_left"
            steps = 2 if abs(yaw) >= 42 else 1
            self._dog.do_action(turn, step_count=steps, speed=98)
            self._dog.wait_legs_done()
            yaw = 0
            self._dog.head_move([[0, 0, pitch]], immediately=True, speed=65)

        distance = self._safe_sensor(lambda: round(float(self._dog.read_distance()), 1))
        self._dog.do_action("sit", speed=65)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        time.sleep(0.4)

        from pidog.preset_actions import hand_shake

        hand_shake(self._dog)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        if color == "orange":
            self._set_light("boom", "#FF7A00", bps=2.2, brightness=1)
        self._bark_once(yaw=yaw, pitch=pitch)
        position_ru = {"left": "слева", "right": "справа", "center": "по центру"}[position]
        if isinstance(distance, (int, float)):
            report = (
                f"{self._russian_color(color).capitalize()} цвет {position_ru}. "
                f"Расстояние до предмета {distance:.1f} сантиметра")
        else:
            report = f"{self._russian_color(color).capitalize()} цвет {position_ru}"
        spoken = self._try_speak_text(report)
        self._dog.do_action("stand", speed=75)
        return {
            "found": True, "color": color,
            "x": round(found["x"]), "y": round(found["y"]),
            "position": position, "distance_cm": distance, "spoken": spoken,
            "message": (
                f"Цвет {self._russian_color(color)} найден {position_ru}"
                + (f", расстояние {distance:.1f} см" if isinstance(distance, (int, float)) else "")
                + " — Пайдог повернулся, указал лапой и встал"
                + ("" if spoken else " (голос Piper недоступен)")),
        }

    def _follow_face(self) -> dict[str, Any]:
        self._ensure_camera()
        try:
            self._vilib.close_color_detection()
        except Exception:
            LOG.debug("could not pause color detection for face tracking", exc_info=True)
        detector = self._create_face_detector()
        # YuNet is substantially more reliable than Vilib's frontal-only Haar
        # cascade for side views and backlit rooms. Avoid running both at once
        # on the Raspberry Pi; retain Vilib as a fallback for older OpenCV.
        self._set_face_detection(detector is None)
        self._start_behavior(
            "follow-face",
            lambda stop_event: self._follow_face_worker(stop_event, detector),
        )
        return {"active": True, "message": "Пайдог следит за лицом"}

    def _stop_face_follow(self) -> dict[str, Any]:
        self._cancel_behavior()
        if self._vilib is not None:
            self._set_face_detection(False)
        self._dog.head_move([[0, 0, 0]], immediately=True, speed=65)
        return {"active": False, "message": "Слежение за лицом остановлено"}

    def _follow_object(self) -> dict[str, Any]:
        """Lock onto the image patch centered in the frame and follow it."""
        self._ensure_camera()
        try:
            self._vilib.close_color_detection()
        except Exception:
            LOG.debug("could not pause color detection for object tracking", exc_info=True)
        try:
            self._set_face_detection(False)
        except Exception:
            LOG.debug("could not pause face detection for object tracking", exc_info=True)

        frame = self._camera_frame()
        box = self._center_tracking_box(frame)
        tracker, tracker_name = self._create_object_tracker()
        initialized = tracker.init(frame, box)
        if initialized is False:
            raise RuntimeError("не удалось зафиксировать предмет в центре кадра")
        self._start_behavior(
            "follow-object",
            lambda stop_event: self._follow_object_worker(stop_event, tracker),
        )
        LOG.info("object tracking tracker=%s box=%s", tracker_name, box)
        return {
            "active": True,
            "target_box": [round(value) for value in box],
            "message": "Пайдог следит за предметом в центре кадра",
        }

    def _stop_object_follow(self) -> dict[str, Any]:
        self._cancel_behavior()
        self._dog.head_move([[0, 0, 0]], immediately=True, speed=65)
        return {"active": False, "message": "Слежение за предметом остановлено"}

    def _camera_frame(self, timeout: float = 2.0) -> Any:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            frame = getattr(self._vilib, "img", None)
            if len(getattr(frame, "shape", ())) >= 2:
                return frame.copy()
            time.sleep(0.05)
        raise RuntimeError("камера не передаёт кадры для слежения за предметом")

    @staticmethod
    def _center_tracking_box(frame: Any) -> tuple[int, int, int, int]:
        height, width = frame.shape[:2]
        side = max(64, round(min(width, height) * 0.35))
        side = min(side, width, height)
        return (
            (width - side) // 2,
            (height - side) // 2,
            side, side,
        )

    @staticmethod
    def _create_object_tracker() -> tuple[Any, str]:
        try:
            import cv2

            namespaces = (cv2, getattr(cv2, "legacy", None))
            for tracker_name in ("CSRT", "KCF", "MIL"):
                factory_name = f"Tracker{tracker_name}_create"
                for namespace in namespaces:
                    factory = getattr(namespace, factory_name, None) if namespace else None
                    if factory is not None:
                        return factory(), tracker_name
        except Exception as error:
            raise RuntimeError(f"OpenCV-трекер недоступен: {error}") from error
        raise RuntimeError("OpenCV не поддерживает слежение за произвольным предметом")

    def _follow_object_worker(self, stop_event: threading.Event,
                              tracker: Any) -> None:
        yaw = 0.0
        pitch = 0.0
        center_x, center_y = self._camera_center()
        misses = 0
        while not stop_event.wait(0.04):
            frame = getattr(self._vilib, "img", None)
            if len(getattr(frame, "shape", ())) < 2:
                continue
            found, box = tracker.update(frame.copy())
            if not found:
                misses += 1
                if misses >= 12:
                    LOG.info("object tracking stopped: target lost")
                    return
                continue
            misses = 0
            x, y, width, height = (float(value) for value in box)
            target_x = x + width / 2
            target_y = y + height / 2
            error_x = center_x - target_x
            error_y = center_y - target_y
            if abs(error_x) < 8 and abs(error_y) < 6:
                continue
            yaw = self._clamp(yaw + error_x * 0.045, -80, 80)
            pitch = self._clamp(pitch + error_y * 0.035, -30, 30)
            self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=75)

    def _set_face_detection(self, enabled: bool) -> None:
        """Toggle face detection across current and legacy Vilib releases."""
        # Current Vilib calls this face detection. Older PiDog images expose
        # the same detector as human_detect_switch, so retain that fallback.
        switch = getattr(self._vilib, "face_detect_switch", None)
        if switch is None:
            switch = getattr(self._vilib, "human_detect_switch", None)
        if switch is None:
            raise RuntimeError("установленная Vilib не поддерживает распознавание лиц")
        switch(enabled)

    def _camera_center(self) -> tuple[float, float]:
        """Return the center used by Vilib's detection coordinates."""
        width = float(getattr(self._vilib, "camera_width", 640) or 640)
        height = float(getattr(self._vilib, "camera_height", 480) or 480)
        return width / 2, height / 2

    def _create_face_detector(self) -> Any | None:
        """Create the bundled YuNet detector, or use Vilib on older images."""
        model_path = Path(__file__).with_name("face_detection_yunet_2023mar.onnx")
        if not model_path.is_file():
            LOG.warning("YuNet face model is missing; using Vilib face detection")
            return None
        try:
            import cv2

            factory = getattr(cv2, "FaceDetectorYN", None)
            if factory is None:
                LOG.warning("OpenCV has no FaceDetectorYN; using Vilib face detection")
                return None
            center_x, center_y = self._camera_center()
            detector = factory.create(
                str(model_path), "", (round(center_x * 2), round(center_y * 2)),
                0.5, 0.3, 5000,
            )
            LOG.info("face tracking detector=YuNet model=%s", model_path.name)
            return detector
        except Exception:
            LOG.exception("could not initialize YuNet; using Vilib face detection")
            return None

    def _detect_face_yunet(self, detector: Any) -> dict[str, float | int]:
        frame = getattr(self._vilib, "img", None)
        shape = getattr(frame, "shape", ())
        if len(shape) < 2:
            return {"human_n": 0}
        # Vilib replaces img atomically for each camera frame. Copy it so its
        # next processing pass cannot modify the pixels during inference.
        frame = frame.copy()
        height, width = frame.shape[:2]
        detector.setInputSize((int(width), int(height)))
        _, faces = detector.detect(frame)
        return self._face_parameters(faces)

    @staticmethod
    def _face_parameters(faces: Any) -> dict[str, float | int]:
        if faces is None or len(faces) == 0:
            return {"human_n": 0}
        face = max(faces, key=lambda item: float(item[2]) * float(item[3]))
        x, y, width, height = (float(face[index]) for index in range(4))
        return {
            "human_n": len(faces),
            "human_x": x + width / 2,
            "human_y": y + height / 2,
            "human_w": width,
            "human_h": height,
        }

    def _follow_face_worker(self, stop_event: threading.Event,
                            detector: Any | None = None) -> None:
        yaw = 0.0
        pitch = 0.0
        center_x, center_y = self._camera_center()
        seen_face = False
        lost_since: float | None = None
        barked_for_loss = False
        while not stop_event.wait(0.08):
            parameters = (
                self._detect_face_yunet(detector)
                if detector is not None
                else dict(self._vilib.detect_obj_parameter)
            )
            faces = int(parameters.get("human_n", 0) or 0)
            if faces > 0:
                seen_face = True
                lost_since = None
                barked_for_loss = False
                x = float(parameters.get("human_x", center_x) or center_x)
                y = float(parameters.get("human_y", center_y) or center_y)
                yaw = self._clamp(yaw + (center_x - x) * 0.045, -80, 80)
                pitch = self._clamp(pitch + (center_y - y) * 0.035, -30, 30)
                self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=80)
                continue

            if not seen_face:
                continue
            if lost_since is None:
                lost_since = time.monotonic()
            elif not barked_for_loss and time.monotonic() - lost_since >= 2.0:
                barked_for_loss = True
                self._bark_once(yaw=yaw, pitch=pitch)
