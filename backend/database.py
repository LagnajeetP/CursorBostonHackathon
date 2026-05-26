"""SQLite layer for the Hoops AI demo.

We keep this tiny: a single file, a few tables, raw SQL. Hackathon scope.
Tables:
  - players       : login + profile (intake info that doesn't change session-to-session)
  - health        : longitudinal health metrics (sleep, HRV, soreness, weight)
  - performance   : historical game/practice stat lines
  - sessions      : a single coaching session (notes + live metrics + cached AI output)
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parent / "hoops.db"))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,                 -- demo-only plaintext, do NOT ship
    full_name TEXT NOT NULL,
    position TEXT NOT NULL,
    team TEXT NOT NULL,
    height_in INTEGER NOT NULL,
    weight_lb INTEGER NOT NULL,
    age INTEGER NOT NULL,
    dominant_hand TEXT NOT NULL,
    intake_notes TEXT
);

CREATE TABLE IF NOT EXISTS health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    recorded_on TEXT NOT NULL,              -- ISO date
    sleep_hours REAL,
    hrv_ms REAL,
    resting_hr INTEGER,
    soreness_0_10 INTEGER,
    hydration_0_10 INTEGER,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    game_date TEXT NOT NULL,
    opponent TEXT,
    minutes REAL,
    points INTEGER,
    rebounds INTEGER,
    assists INTEGER,
    steals INTEGER,
    blocks INTEGER,
    turnovers INTEGER,
    fg_pct REAL,
    three_pct REAL,
    ft_pct REAL,
    plus_minus INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    session_type TEXT NOT NULL,             -- practice | film | conditioning | game
    coach_notes TEXT,
    -- live metrics captured during the session
    drill_focus TEXT,
    shots_taken INTEGER,
    shots_made INTEGER,
    sprint_count INTEGER,
    avg_heart_rate INTEGER,
    perceived_exertion_0_10 INTEGER,
    pain_flags TEXT,                        -- comma-separated areas e.g. 'right knee, lower back'
    -- cached AI output so we don't re-bill Claude on refresh
    ai_quick_summary TEXT,
    ai_deep_insights TEXT
);
"""


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)


def insert(table: str, row: dict[str, Any]) -> int:
    cols = ",".join(row.keys())
    placeholders = ",".join(["?"] * len(row))
    with get_db() as conn:
        cur = conn.execute(
            f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", tuple(row.values())
        )
        return int(cur.lastrowid)


def query(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
        return [dict(r) for r in rows]


def query_one(sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def update(sql: str, params: Iterable[Any] = ()) -> None:
    with get_db() as conn:
        conn.execute(sql, tuple(params))
