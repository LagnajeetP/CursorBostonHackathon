"""FastAPI app for the Hoops AI demo.

Run:
    cd backend
    cp .env.example .env  # then add your ANTHROPIC_API_KEY
    pip install -r requirements.txt
    python seed_data.py
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")

import claude_service  # noqa: E402  (after load_dotenv)
import database as db  # noqa: E402
from seed_data import seed  # noqa: E402


app = FastAPI(title="Hoops AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo only
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()
    seed()  # idempotent — only inserts demo players if missing


# ---------- Schemas ----------

class LoginIn(BaseModel):
    username: str
    password: str


class SessionIn(BaseModel):
    player_id: int
    session_type: str
    coach_notes: str | None = None
    drill_focus: str | None = None
    shots_taken: int | None = None
    shots_made: int | None = None
    sprint_count: int | None = None
    avg_heart_rate: int | None = None
    perceived_exertion_0_10: int | None = None
    pain_flags: str | None = None


# ---------- Auth ----------

@app.post("/api/login")
def login(body: LoginIn) -> dict:
    row = db.query_one(
        "SELECT * FROM players WHERE username = ? AND password = ?",
        (body.username, body.password),
    )
    if not row:
        raise HTTPException(401, "Invalid credentials. Try jstar / demo")
    row.pop("password", None)
    return {"player": row}


# ---------- Past / non-session info ----------

@app.get("/api/players/{player_id}/profile")
def profile(player_id: int) -> dict:
    p = db.query_one("SELECT * FROM players WHERE id = ?", (player_id,))
    if not p:
        raise HTTPException(404, "player not found")
    p.pop("password", None)
    return p


@app.get("/api/players/{player_id}/health")
def health(player_id: int) -> list[dict]:
    return db.query(
        "SELECT * FROM health WHERE player_id = ? ORDER BY recorded_on DESC LIMIT 30",
        (player_id,),
    )


@app.get("/api/players/{player_id}/performance")
def performance(player_id: int) -> list[dict]:
    return db.query(
        "SELECT * FROM performance WHERE player_id = ? ORDER BY game_date DESC LIMIT 20",
        (player_id,),
    )


@app.get("/api/players/{player_id}/sessions")
def list_sessions(player_id: int) -> list[dict]:
    return db.query(
        "SELECT id, created_at, session_type, drill_focus, "
        "shots_taken, shots_made, sprint_count, avg_heart_rate, "
        "perceived_exertion_0_10, pain_flags, coach_notes, ai_quick_summary "
        "FROM sessions WHERE player_id = ? ORDER BY created_at DESC LIMIT 50",
        (player_id,),
    )


# ---------- Live session ----------

@app.post("/api/sessions")
def create_session(body: SessionIn) -> dict:
    """Create a session row AND run the cheap Haiku quick-summary in one shot.

    We do this on save (not on every keystroke) to keep API spend bounded.
    """
    sid = db.insert("sessions", body.model_dump(exclude_none=False))
    try:
        summary = claude_service.quick_summary(body.player_id, sid)
    except Exception as exc:  # don't fail the save if Claude hiccups
        summary = f"_AI summary unavailable: {exc}_"
    return {"session_id": sid, "ai_quick_summary": summary}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: int) -> dict:
    row = db.query_one("SELECT * FROM sessions WHERE id = ?", (session_id,))
    if not row:
        raise HTTPException(404, "session not found")
    return row


@app.get("/api/sessions/{session_id}/insights")
def get_insights(session_id: int, force: bool = False) -> dict:
    """Deep Sonnet analysis. Cached after first call unless ?force=true."""
    sess = db.query_one("SELECT player_id FROM sessions WHERE id = ?", (session_id,))
    if not sess:
        raise HTTPException(404, "session not found")
    text = claude_service.deep_insights(sess["player_id"], session_id, force=force)
    return {"session_id": session_id, "insights": text}


# ---------- Demo helpers ----------

@app.get("/api/demo/script")
def demo_script() -> dict:
    """Walks the UI through a guided tour."""
    return {
        "steps": [
            {"target": "login", "text": "Log in as jstar / demo to enter the dashboard."},
            {"target": "tab-past", "text": "Past Info — intake, 14-day health trends, points & shooting splits, last 10 games."},
            {"target": "tab-session", "text": "Live Session — write coach notes, log metrics, watch the live FG% gauge."},
            {"target": "btn-save-session", "text": "Saving fires a fast Claude (Haiku) summary AND posts the session to the Insights feed."},
            {"target": "tab-insights", "text": "Insights — every session you log appears in the feed. Click any to get a deep Sonnet analysis (cached, grounded via RAG)."},
        ]
    }


@app.get("/")
def root() -> dict:
    return {"ok": True, "service": "hoops-ai", "docs": "/docs"}
