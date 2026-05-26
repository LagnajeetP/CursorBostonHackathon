"""Claude wrapper with lightweight RAG.

Two analysis modes:
  - quick_summary  : runs on every session save. Uses Haiku (cheap, fast).
  - deep_insights  : runs when user opens the Insights tab. Uses Sonnet.

RAG approach (hackathon-pragmatic):
  We don't need a vector DB for this scale. The "knowledge base" is the player's
  own DB rows (intake, health, recent games, prior sessions). We retrieve the
  most relevant slice per query and pass it as a structured `<context>` block.
  Claude is instructed to treat that block as the only source of truth.

Cost guardrails:
  - small max_tokens
  - cached output stored in sessions.ai_* columns
  - we only call Claude on explicit user actions, never on page mount
"""

from __future__ import annotations

import json
import os
from typing import Any

from anthropic import Anthropic

import database as db

_client: Anthropic | None = None


def _client_lazy() -> Anthropic:
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set. Copy backend/.env.example to backend/.env and add your key."
            )
        _client = Anthropic(api_key=key)
    return _client


FAST_MODEL = os.getenv("CLAUDE_FAST_MODEL", "claude-haiku-4-5")
DEEP_MODEL = os.getenv("CLAUDE_DEEP_MODEL", "claude-sonnet-4-6")


# ---------- RAG retrieval ----------

def retrieve_context(player_id: int, session_id: int | None = None) -> dict[str, Any]:
    """Pull the slice of the DB that's relevant for analyzing this session."""
    player = db.query_one("SELECT * FROM players WHERE id = ?", (player_id,))
    health = db.query(
        "SELECT * FROM health WHERE player_id = ? ORDER BY recorded_on DESC LIMIT 7",
        (player_id,),
    )
    games = db.query(
        "SELECT * FROM performance WHERE player_id = ? ORDER BY game_date DESC LIMIT 5",
        (player_id,),
    )
    prior_sessions = db.query(
        "SELECT id, created_at, session_type, coach_notes, drill_focus, "
        "perceived_exertion_0_10, pain_flags FROM sessions "
        "WHERE player_id = ? AND (? IS NULL OR id != ?) "
        "ORDER BY created_at DESC LIMIT 3",
        (player_id, session_id, session_id),
    )
    current = (
        db.query_one("SELECT * FROM sessions WHERE id = ?", (session_id,))
        if session_id
        else None
    )
    return {
        "player": player,
        "recent_health_7d": health,
        "recent_games_5": games,
        "prior_sessions_3": prior_sessions,
        "current_session": current,
    }


def _context_block(ctx: dict[str, Any]) -> str:
    return "<context>\n" + json.dumps(ctx, indent=2, default=str) + "\n</context>"


# ---------- Prompts ----------

QUICK_SYSTEM = (
    "You are an NBA-level performance and sports-medicine assistant. "
    "You speak to coaches in 4-6 crisp bullet points. "
    "You ONLY use facts found in the <context> block. "
    "If something isn't in context, say 'not enough data'. "
    "Always flag any pain/soreness signal as a CAUTION bullet."
)

QUICK_USER = (
    "Given this player's latest session and recent history, produce:\n"
    "1) One-line headline (what mattered today).\n"
    "2) 3 specific next-practice focus areas tied to the data.\n"
    "3) 1 CAUTION bullet on injury/load risk (or 'no flags').\n"
    "Keep the entire response under 140 words. Markdown bullets only."
)

DEEP_SYSTEM = (
    "You are an elite basketball performance analyst and athletic trainer. "
    "Ground every claim in the <context> JSON; cite the field you used in parentheses. "
    "If the data does not support a claim, say so. Never invent stats."
)

DEEP_USER = (
    "Produce a detailed analysis for the coach with these sections in Markdown:\n"
    "## Headline\n"
    "## Strengths (last 5 games + this session)\n"
    "## Weaknesses / Trends\n"
    "## Health & Load Signals\n"
    "## Injury Caution\n"
    "## Recommended Next 3 Sessions (drill -> why -> success metric)\n"
    "## Confidence Notes (what's missing in the data)\n"
    "Be specific. Use numbers from context. ~350-500 words."
)


# ---------- Public API ----------

def quick_summary(player_id: int, session_id: int) -> str:
    ctx = retrieve_context(player_id, session_id)
    msg = _client_lazy().messages.create(
        model=FAST_MODEL,
        max_tokens=400,
        system=QUICK_SYSTEM,
        messages=[{"role": "user", "content": f"{_context_block(ctx)}\n\n{QUICK_USER}"}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    db.update(
        "UPDATE sessions SET ai_quick_summary = ? WHERE id = ?", (text, session_id)
    )
    return text


def deep_insights(player_id: int, session_id: int, force: bool = False) -> str:
    if not force:
        row = db.query_one(
            "SELECT ai_deep_insights FROM sessions WHERE id = ?", (session_id,)
        )
        if row and row.get("ai_deep_insights"):
            return row["ai_deep_insights"]  # cache hit — no API spend

    ctx = retrieve_context(player_id, session_id)
    msg = _client_lazy().messages.create(
        model=DEEP_MODEL,
        max_tokens=1200,
        system=DEEP_SYSTEM,
        messages=[{"role": "user", "content": f"{_context_block(ctx)}\n\n{DEEP_USER}"}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    db.update(
        "UPDATE sessions SET ai_deep_insights = ? WHERE id = ?", (text, session_id)
    )
    return text
