"""
SQLite-backed persistence for laundry machine snapshots.

One table, append-only, keyed by (poll_time, bluetooth_address). Each row is
one machine's state at one poll. Reads return plain dicts so callers don't
have to know the schema.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path("laundry_data.sqlite")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS machine_snapshots (
    poll_time                    TEXT    NOT NULL,
    machine_name                 TEXT,
    location_name                TEXT,
    bluetooth_address            TEXT    NOT NULL,
    status                       TEXT,
    platform_type                TEXT,
    estimated_completion_time    TEXT,
    machine_type                 TEXT,
    top_off_available            INTEGER,
    multi_top_off_available      INTEGER,
    super_cycle_available        INTEGER,
    top_off_cost                 REAL,
    minutes_per_top_off          INTEGER,
    PRIMARY KEY (poll_time, bluetooth_address)
);
"""

_INSERT = """
INSERT OR REPLACE INTO machine_snapshots VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);
"""

_LATEST_PER_MACHINE = """
WITH ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY bluetooth_address
               ORDER BY poll_time DESC
           ) AS rn
    FROM machine_snapshots
)
SELECT
    poll_time, machine_name, location_name, bluetooth_address, status,
    platform_type, estimated_completion_time, machine_type,
    top_off_available, multi_top_off_available, super_cycle_available,
    top_off_cost, minutes_per_top_off
FROM ranked
WHERE rn = 1
ORDER BY machine_type, machine_name;
"""


def _connect(path: Path = DB_PATH) -> sqlite3.Connection:
    return sqlite3.connect(str(path))


def init_db(path: Path = DB_PATH) -> None:
    """Create the schema if it doesn't exist."""
    with _connect(path) as conn:
        conn.execute(_SCHEMA)


def _parse_iso(s) -> datetime | None:
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def _bool(v) -> int:
    return 1 if v else 0


def _to_row(machine: dict, poll_time: datetime) -> tuple:
    """Project a machine record onto the table's column order."""
    ect_raw = machine.get("estimatedCompletionTime")
    ect = _parse_iso(ect_raw) if ect_raw else None

    def _f(name: str, default=None):
        return machine.get(name, default)

    return (
        poll_time.isoformat(),
        _f("machineName"),
        _f("locationName"),
        _f("bluetoothAddress"),
        _f("status"),
        _f("platformType"),
        ect.isoformat() if ect else None,
        _f("machineType"),
        _bool(_f("topOffAvailable")),
        _bool(_f("multiTopOffAvailable")),
        _bool(_f("superCycleAvailable")),
        _f("topOffCost"),
        _f("minutesPerTopOff"),
    )


def record_snapshot(
    machines: list[dict],
    poll_time: datetime | None = None,
    path: Path = DB_PATH,
) -> datetime:
    """Insert one poll's worth of machine records. Returns the poll_time used."""
    poll_time = poll_time or datetime.now(timezone.utc)
    rows = [_to_row(m, poll_time) for m in machines]
    with _connect(path) as conn:
        conn.executemany(_INSERT, rows)
        conn.commit()
    return poll_time


def latest_snapshot(path: Path = DB_PATH) -> list[dict]:
    """Return one record per machine, from the most recent poll."""
    with _connect(path) as conn:
        conn.row_factory = sqlite3.Row
        result = conn.execute(_LATEST_PER_MACHINE).fetchall()
    return [dict(row) for row in result]


def row_count(path: Path = DB_PATH) -> int:
    with _connect(path) as conn:
        return conn.execute("SELECT COUNT(*) FROM machine_snapshots").fetchone()[0]