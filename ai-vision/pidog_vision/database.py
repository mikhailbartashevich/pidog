"""SQLite schema initialization with a fixed migration allowlist."""

from __future__ import annotations

import sqlite3
from pathlib import Path


_TABLE_INFO_QUERIES = {
    "face": "PRAGMA table_info(face)",
    "object_memory": "PRAGMA table_info(object_memory)",
}
_COLUMN_MIGRATIONS = {
    ("face", "image"): "ALTER TABLE face ADD COLUMN image BLOB",
    ("face", "updated_at"): "ALTER TABLE face ADD COLUMN updated_at INTEGER",
    ("object_memory", "image"): "ALTER TABLE object_memory ADD COLUMN image BLOB",
    ("object_memory", "updated_at"): "ALTER TABLE object_memory ADD COLUMN updated_at INTEGER",
}


def _add_column_if_missing(connection: sqlite3.Connection, table: str, column: str) -> None:
    """Apply only a static migration; no SQL identifier is ever interpolated."""
    try:
        info_query = _TABLE_INFO_QUERIES[table]
        migration = _COLUMN_MIGRATIONS[(table, column)]
    except KeyError as error:
        raise ValueError("unsupported database migration") from error
    columns = {row[1] for row in connection.execute(info_query)}
    if column not in columns:
        connection.execute(migration)


def initialize_face_database(database: Path) -> None:
    database.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS face "
            "(name TEXT NOT NULL, embedding BLOB NOT NULL, image BLOB, updated_at INTEGER)"
        )
        _add_column_if_missing(connection, "face", "image")
        _add_column_if_missing(connection, "face", "updated_at")


def initialize_object_database(database: Path) -> None:
    database.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS object_memory "
            "(name TEXT NOT NULL, feature BLOB NOT NULL, image BLOB, updated_at INTEGER)"
        )
        _add_column_if_missing(connection, "object_memory", "image")
        _add_column_if_missing(connection, "object_memory", "updated_at")
        # Object recognition is also used for pets.  A target can be shown in
        # the "people"/guard list while its visual descriptor remains in the
        # object table; moving it to the face table would make it impossible
        # to recognize a cat.
        connection.execute(
            "CREATE TABLE IF NOT EXISTS guard_person "
            "(name TEXT NOT NULL PRIMARY KEY)"
        )
        connection.execute(
            "INSERT OR IGNORE INTO guard_person(name) "
            "SELECT DISTINCT name FROM object_memory "
            "WHERE name LIKE '%cat%' COLLATE NOCASE OR name LIKE '%кот%'"
        )
