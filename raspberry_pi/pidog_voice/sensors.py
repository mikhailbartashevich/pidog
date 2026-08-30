"""Sensor snapshots, power detection, and sensor-driven actions."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Callable

from .constants import LOG


class SensorsMixin:
    def sensors(self) -> dict[str, Any]:
        with self._lock:
            if self._dry_run:
                return {
                    "distance_cm": 42.0, "touch": "N", "sound_detected": False,
                    "sound_direction": None, "camera": self._camera_started,
                    "battery_voltage": 7.6, "battery_percent": 60,
                    "external_power": False, "charging": False,
                    "power_detection": "dry-run",
                }
            result: dict[str, Any] = {"camera": self._camera_started}
            voltage = self._safe_sensor(lambda: float(self._dog.get_battery_voltage()))
            result["battery_voltage"] = round(voltage, 2) if voltage is not None else None
            result["battery_percent"] = self._battery_percent(voltage) if voltage is not None else None
            result.update(self._power_status(voltage))
            result["distance_cm"] = self._safe_sensor(
                lambda: round(float(self._dog.read_distance()), 1))
            result["touch"] = self._safe_sensor(lambda: str(self._dog.dual_touch.read()))
            detected = self._safe_sensor(lambda: bool(self._dog.ears.isdetected()))
            result["sound_detected"] = detected if isinstance(detected, bool) else False
            result["sound_direction"] = (
                self._safe_sensor(lambda: int(self._dog.ears.read())) if detected is True else None
            )
            result["acceleration"] = self._serializable_sensor(lambda: self._dog.accData)
            result["gyroscope"] = self._serializable_sensor(lambda: self._dog.gyroData)
            return result

    def _power_status(self, voltage: float | None) -> dict[str, Any]:
        """Report external power without confusing a full battery with charging."""
        sysfs_status = self._read_power_supply()
        if sysfs_status is not None:
            external, charging = sysfs_status
            self._external_power = external
            return {
                "external_power": external,
                "charging": charging,
                "power_detection": "power_supply",
            }

        if voltage is None:
            return {
                "external_power": self._external_power,
                "charging": None,
                "power_detection": "unavailable",
            }

        now = time.monotonic()
        self._power_samples.append((now, voltage))
        while self._power_samples and self._power_samples[0][0] < now - 180:
            self._power_samples.popleft()

        reference = next(
            (sample for sample in self._power_samples if now - sample[0] >= 20), None)
        charging: bool | None = None
        detection = "voltage_wait"
        if reference is not None:
            delta = voltage - reference[1]
            detection = "voltage_trend"
            if delta >= 0.02:
                self._external_power = True
                charging = True
            elif delta <= -0.02:
                self._external_power = False
                charging = False
            elif self._external_power is False:
                charging = False

        return {
            "external_power": self._external_power,
            "charging": charging,
            "power_detection": detection,
        }

    @staticmethod
    def _read_power_supply() -> tuple[bool, bool | None] | None:
        configured = os.environ.get("PIDOG_EXTERNAL_POWER_PATH")
        online_paths: list[Path] = []
        if configured:
            online_paths.append(Path(configured).expanduser())
        power_root = Path("/sys/class/power_supply")
        if power_root.is_dir():
            online_paths.extend(sorted(power_root.glob("*/online")))

        for online_path in online_paths:
            if not configured or online_path != Path(configured).expanduser():
                try:
                    supply_type = (online_path.parent / "type").read_text(
                        encoding="utf-8").strip().lower()
                except OSError:
                    continue
                if supply_type not in {"mains", "usb", "usb_c", "usb_pd", "wireless"}:
                    continue
            try:
                value = online_path.read_text(encoding="utf-8").strip().lower()
            except OSError:
                continue
            if value not in {"0", "1", "false", "true", "off", "on"}:
                continue
            external = value in {"1", "true", "on"}
            charging: bool | None = None
            try:
                status = (online_path.parent / "status").read_text(
                    encoding="utf-8").strip().lower()
                if status:
                    charging = status == "charging"
            except OSError:
                pass
            return external, charging
        return None

    def _measure_distance(self) -> dict[str, Any]:
        distance = round(float(self._dog.read_distance()), 1)
        return {"distance_cm": distance, "message": f"Расстояние: {distance:.1f} см"}

    def _listen_sound(self) -> dict[str, Any]:
        deadline = time.monotonic() + 6
        while time.monotonic() < deadline:
            if self._dog.ears.isdetected():
                direction = int(self._dog.ears.read())
                yaw = direction if direction <= 180 else direction - 360
                yaw = self._clamp(yaw, -80, 80)
                self._dog.head_move([[yaw, 0, 0]], immediately=True, speed=65)
                return {
                    "sound_detected": True, "sound_direction": direction,
                    "message": f"Звук обнаружен, направление {direction}°",
                }
            time.sleep(0.1)
        self._dog.do_action("shake_head", speed=70)
        return {"sound_detected": False, "message": "Звук не обнаружен"}

    def _show_battery(self) -> dict[str, Any]:
        voltage = float(self._dog.get_battery_voltage())
        percent = self._battery_percent(voltage)
        lit = max(1, round(percent / 100 * 8)) if percent > 0 else 0
        pixels = []
        for index in range(8):
            if index >= lit:
                pixels.append([0, 0, 0])
            elif index < 2:
                pixels.append([255, 20, 10])
            elif index < 5:
                pixels.append([255, 190, 0])
            else:
                pixels.append([0, 230, 80])
        # Stop the animation loop from overwriting the static eight-LED gauge.
        self._dog.rgb_strip.style = None
        self._dog.rgb_strip.display(pixels)
        return {
            "battery_voltage": round(voltage, 2), "battery_percent": percent,
            "message": f"Заряд примерно {percent}%, напряжение {voltage:.2f} В",
        }

    @staticmethod
    def _battery_percent(voltage: float) -> int:
        # PiDog uses a 2-cell pack: show 0% at 6.4 V and 100% at 8.4 V.
        return round(max(0.0, min(100.0, (voltage - 6.4) / 2.0 * 100.0)))

    @staticmethod
    def _safe_sensor(reader: Callable[[], Any]) -> Any:
        try:
            return reader()
        except Exception as error:
            LOG.warning("sensor read failed: %s", error)
            return None

    def _serializable_sensor(self, reader: Callable[[], Any]) -> Any:
        value = self._safe_sensor(reader)
        if value is None:
            return None
        if hasattr(value, "tolist"):
            value = value.tolist()
        if isinstance(value, (tuple, list)):
            return [round(float(item), 3) for item in value]
        return value

    @staticmethod
    def _clamp(value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    @staticmethod
    def _russian_color(color: str) -> str:
        return {
            "orange": "оранжевый", "red": "красный", "yellow": "жёлтый",
            "green": "зелёный", "blue": "синий", "purple": "фиолетовый",
        }.get(color, color)

