"""Lighting, camera, and color-search behavior."""

from __future__ import annotations

import time
import threading
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
            self._vilib.human_detect_switch(False)
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
            self._vilib.human_detect_switch(False)
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
        self._vilib.human_detect_switch(True)
        self._start_behavior("follow-face", self._follow_face_worker)
        return {"active": True, "message": "Пайдог следит за лицом"}

    def _stop_face_follow(self) -> dict[str, Any]:
        self._cancel_behavior()
        if self._vilib is not None:
            self._vilib.human_detect_switch(False)
        self._dog.head_move([[0, 0, 0]], immediately=True, speed=65)
        return {"active": False, "message": "Слежение за лицом остановлено"}

    def _follow_face_worker(self, stop_event: threading.Event) -> None:
        yaw = 0.0
        pitch = 0.0
        seen_face = False
        lost_since: float | None = None
        barked_for_loss = False
        while not stop_event.wait(0.08):
            parameters = dict(self._vilib.detect_obj_parameter)
            faces = int(parameters.get("human_n", 0) or 0)
            if faces > 0:
                seen_face = True
                lost_since = None
                barked_for_loss = False
                x = float(parameters.get("human_x", 160) or 160)
                y = float(parameters.get("human_y", 120) or 120)
                yaw = self._clamp(yaw + (160 - x) * 0.045, -80, 80)
                pitch = self._clamp(pitch + (120 - y) * 0.035, -30, 30)
                self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=80)
                continue

            if not seen_face:
                continue
            if lost_since is None:
                lost_since = time.monotonic()
            elif not barked_for_loss and time.monotonic() - lost_since >= 2.0:
                barked_for_loss = True
                self._bark()
