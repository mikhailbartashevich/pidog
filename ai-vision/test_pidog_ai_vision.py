"""Regression tests for the persistent AI Vision memory registries."""

from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


VISION_ROOT = str(Path(__file__).parent)
if VISION_ROOT not in sys.path:
    sys.path.insert(0, VISION_ROOT)
import pidog_ai_vision as vision


class RegistrySampleTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.database = Path(self._temporary_directory.name) / "memory.sqlite3"

    def tearDown(self) -> None:
        self._temporary_directory.cleanup()

    def _create_face_registry(self) -> object:
        registry = vision.FaceRegistry.__new__(vision.FaceRegistry)
        registry._available = True
        registry._database = self.database
        registry._features = lambda _frame: [(SimpleNamespace(), [0.1, 0.2])]
        registry._face_thumbnail = lambda _frame, _face: b"face-preview"
        with sqlite3.connect(self.database) as connection:
            connection.execute(
                "CREATE TABLE face "
                "(name TEXT NOT NULL, embedding BLOB NOT NULL, image BLOB, updated_at INTEGER)"
            )
        return registry

    def _create_object_registry(self) -> object:
        registry = vision.ObjectRegistry.__new__(vision.ObjectRegistry)
        registry._database = self.database
        registry._feature = lambda _image: SimpleNamespace(tobytes=lambda: b"object-feature")
        registry._jpeg_thumbnail = lambda _image: b"object-preview"
        with sqlite3.connect(self.database) as connection:
            connection.execute(
                "CREATE TABLE object_memory "
                "(name TEXT NOT NULL, feature BLOB NOT NULL, image BLOB, updated_at INTEGER)"
            )
        return registry

    def test_face_enrollment_appends_samples_with_the_same_name(self) -> None:
        registry = self._create_face_registry()
        numpy = SimpleNamespace(
            float32=object(),
            asarray=lambda _feature, dtype: SimpleNamespace(tobytes=lambda: b"face-feature"),
        )

        with mock.patch.dict(sys.modules, {"numpy": numpy}):
            registry.enroll("Mikhail", object())
            registry.enroll("Mikhail", object())

        with sqlite3.connect(self.database) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM face WHERE name = ?", ("Mikhail",)
            ).fetchone()[0]
        self.assertEqual(count, 2)

    def test_object_enrollment_appends_samples_with_the_same_name(self) -> None:
        registry = self._create_object_registry()

        registry.enroll("blue ball", object())
        registry.enroll("blue ball", object())

        with sqlite3.connect(self.database) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM object_memory WHERE name = ?", ("blue ball",)
            ).fetchone()[0]
        self.assertEqual(count, 2)

    def test_renaming_keeps_existing_samples_at_the_new_name(self) -> None:
        registry = self._create_object_registry()
        with sqlite3.connect(self.database) as connection:
            connection.executemany(
                "INSERT INTO object_memory(name, feature, image, updated_at) VALUES (?, ?, ?, ?)",
                [("old", b"one", b"one", 1), ("new", b"two", b"two", 2)],
            )

        self.assertTrue(registry.rename("old", "new"))

        with sqlite3.connect(self.database) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM object_memory WHERE name = ?", ("new",)
            ).fetchone()[0]
        self.assertEqual(count, 2)

    def test_delete_treats_an_sql_injection_payload_as_a_literal_name(self) -> None:
        registry = self._create_object_registry()
        with sqlite3.connect(self.database) as connection:
            connection.executemany(
                "INSERT INTO object_memory(name, feature, image, updated_at) VALUES (?, ?, ?, ?)",
                [("first", b"one", b"one", 1), ("second", b"two", b"two", 2)],
            )

        registry.delete("' OR 1=1 --")

        with sqlite3.connect(self.database) as connection:
            count = connection.execute("SELECT COUNT(*) FROM object_memory").fetchone()[0]
        self.assertEqual(count, 2)


if __name__ == "__main__":
    unittest.main()
