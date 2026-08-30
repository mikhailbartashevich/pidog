"""Lighting, camera, and color-search behavior."""

from __future__ import annotations

import time
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
            self._vilib.camera_close()
        except Exception:
            LOG.debug("could not close camera", exc_info=True)
        self._camera_started = False
        self._vilib = None

    def _find_color(self, color: str) -> dict[str, Any]:
        """Scan for a confirmed color, point with a paw and bark when found."""
        self._ensure_camera()
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
        self._dog.do_action("sit", speed=65)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        time.sleep(0.4)

        from pidog.preset_actions import bark, hand_shake

        hand_shake(self._dog)
        self._dog.head_move([[yaw, 0, pitch]], immediately=True, speed=55)
        if color == "orange":
            self._set_light("boom", "#FF7A00", bps=2.2, brightness=1)
        self._require_audio()
        self._play_with_speaker(
            lambda: bark(self._dog, yrp=[yaw, 0, pitch], volume=100))
        return {
            "found": True, "color": color,
            "x": round(found["x"]), "y": round(found["y"]),
            "message": f"Цвет {self._russian_color(color)} найден — Пайдог указал лапой и залаял",
        }


