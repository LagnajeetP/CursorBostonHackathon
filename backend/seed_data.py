"""Seed synthetic basketball data so the demo works without the Kaggle download.

Two demo players. If you later drop the Kaggle CSV into ./data/games.csv we'll
opportunistically import a few games; otherwise we synthesize realistic lines.
"""

from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

from database import init_db, insert, query_one


DEMO_PLAYERS = [
    {
        "username": "jstar",
        "password": "demo",                 # demo-only
        "full_name": "Jordan Starling",
        "position": "SG",
        "team": "Boston Bytes",
        "height_in": 78,
        "weight_lb": 205,
        "age": 24,
        "dominant_hand": "Right",
        "intake_notes": (
            "Prior right-ankle sprain (Mar 2024, full recovery). "
            "History of mild patellar tendinopathy — manages with eccentric loading. "
            "No surgical history. Lactose intolerant."
        ),
    },
    {
        "username": "mrise",
        "password": "demo",
        "full_name": "Marcus Rise",
        "position": "PF",
        "team": "Boston Bytes",
        "height_in": 81,
        "weight_lb": 235,
        "age": 27,
        "dominant_hand": "Left",
        "intake_notes": (
            "Lower-back tightness flares after back-to-backs. "
            "Recurrent left shoulder impingement managed with band work. "
            "Family history of hypertension — monitors BP weekly."
        ),
    },
]


def _seed_health(player_id: int) -> None:
    today = date.today()
    for i in range(14):
        day = today - timedelta(days=i + 1)
        insert(
            "health",
            {
                "player_id": player_id,
                "recorded_on": day.isoformat(),
                "sleep_hours": round(random.uniform(5.5, 8.5), 1),
                "hrv_ms": round(random.uniform(45, 90), 1),
                "resting_hr": random.randint(48, 62),
                "soreness_0_10": random.randint(1, 6),
                "hydration_0_10": random.randint(5, 9),
                "notes": random.choice(
                    ["", "", "tight calves", "great recovery", "light headache", ""]
                ),
            },
        )


def _seed_performance(player_id: int, position: str) -> None:
    opponents = ["Nets", "Sixers", "Heat", "Knicks", "Raptors", "Bucks", "Hawks", "Magic"]
    today = date.today()
    for i in range(10):
        day = today - timedelta(days=(i + 1) * 3)
        scoring_bias = 18 if position in ("SG", "SF", "PG") else 12
        rebound_bias = 10 if position in ("PF", "C") else 4
        insert(
            "performance",
            {
                "player_id": player_id,
                "game_date": day.isoformat(),
                "opponent": random.choice(opponents),
                "minutes": round(random.uniform(22, 36), 1),
                "points": max(0, int(random.gauss(scoring_bias, 6))),
                "rebounds": max(0, int(random.gauss(rebound_bias, 2))),
                "assists": max(0, int(random.gauss(4 if position == "PG" else 2, 1.5))),
                "steals": random.randint(0, 3),
                "blocks": random.randint(0, 2),
                "turnovers": random.randint(0, 4),
                "fg_pct": round(random.uniform(0.38, 0.56), 3),
                "three_pct": round(random.uniform(0.28, 0.44), 3),
                "ft_pct": round(random.uniform(0.68, 0.92), 3),
                "plus_minus": random.randint(-12, 18),
            },
        )


def _maybe_import_kaggle(player_id: int) -> None:
    """If user dropped Kaggle basketball.csv into ./data, sample a few rows.

    We don't require it — the demo runs fine on synthetic data.
    """
    csv_path = Path(__file__).parent / "data" / "games.csv"
    if not csv_path.exists():
        return
    try:
        with csv_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                if count >= 5:
                    break
                insert(
                    "performance",
                    {
                        "player_id": player_id,
                        "game_date": row.get("GAME_DATE", date.today().isoformat())[:10],
                        "opponent": row.get("MATCHUP", "KAGGLE")[:32],
                        "minutes": float(row.get("MIN") or 24),
                        "points": int(float(row.get("PTS") or 12)),
                        "rebounds": int(float(row.get("REB") or 4)),
                        "assists": int(float(row.get("AST") or 2)),
                        "steals": int(float(row.get("STL") or 1)),
                        "blocks": int(float(row.get("BLK") or 0)),
                        "turnovers": int(float(row.get("TOV") or 2)),
                        "fg_pct": float(row.get("FG_PCT") or 0.45),
                        "three_pct": float(row.get("FG3_PCT") or 0.35),
                        "ft_pct": float(row.get("FT_PCT") or 0.78),
                        "plus_minus": int(float(row.get("PLUS_MINUS") or 0)),
                    },
                )
                count += 1
    except Exception as exc:  # never block startup on bad CSV
        print(f"[seed] Kaggle import skipped: {exc}")


def seed() -> None:
    init_db()
    random.seed(42)
    for p in DEMO_PLAYERS:
        existing = query_one("SELECT id FROM players WHERE username = ?", (p["username"],))
        if existing:
            continue
        pid = insert("players", p)
        _seed_health(pid)
        _seed_performance(pid, p["position"])
        _maybe_import_kaggle(pid)
    print("[seed] done")


if __name__ == "__main__":
    seed()
