# Hoops AI — Coach Console

Built at the **Cursor Boston Hackathon**. An AI-assisted coaching dashboard for basketball
players. The coach logs in, reviews the player's intake / health / past performance, captures
a live training session (notes + metrics), and gets a **grounded Claude analysis** of what
to do next — including injury cautions.

All AI analysis goes through the **Anthropic Claude API** with a small RAG layer that pulls
the player's own data out of SQLite and injects it as a strict `<context>` block so the model
cites real numbers and refuses to invent stats.

---

## Overview

The number one threat to a basketball player's career is injury — promising careers are
cut short every year because warning signs in the body (rising soreness, dropping HRV,
poor sleep, accumulating load) get lost in the noise of a season and potential is never
fully met. The second threat, quieter but just as costly, is poor optimization of
improvement: practice plans are written from gut feel and yesterday's game tape, with no
systematic link between what a player did this week and what they should work on next.
**Hoops AI** is a coach console that solves both problems at once by combining a player's
intake / medical history, multi-week health signals, recent game stat lines, and live
session notes into a single grounded view, then asking Claude to read all of that as a
strict source-of-truth context block. After every session the coach writes notes and logs
metrics — shots, sprints, HR, RPE, pain flags — and a fast Claude (Haiku) pass returns a
short, cited recommendation: today's headline, three specific focus areas for next
practice, and an explicit injury-caution bullet if the data warrants it. Opening the
Insights tab triggers a deeper Claude (Sonnet) analysis that produces strengths,
weaknesses, load/health signals, injury caution, and a recommended next three sessions,
all grounded in the player's own numbers via a lightweight RAG retrieval over their SQLite
rows. Every session is persisted and stacks into a session feed with trend charts (RPE,
FG%, sleep, HRV, soreness) so a coach can see at a glance whether a player is trending
toward peak or toward breakdown. The goal is simple: protect careers from injury and
compress the time between *"something is off"* and *"here is exactly what to do about it,"*
so potential is actually realized instead of left on the floor.

---

## Architecture

```
CursorBostonHackathon/
├── backend/                FastAPI + SQLite + Claude
│   ├── main.py             API routes
│   ├── database.py         SQLite schema & helpers
│   ├── claude_service.py   RAG retrieval + Haiku/Sonnet prompts
│   ├── seed_data.py        Synthetic basketball data (+ optional Kaggle import)
│   ├── requirements.txt
│   └── .env.example        Copy to .env, add your ANTHROPIC_API_KEY (gitignored)
└── frontend/               Vite + React, NBA-themed futuristic UI
    ├── src/App.jsx
    ├── src/components/     Login · PastInfo · Session · Insights · DemoTour
    └── src/styles.css
```

### Why two Claude models?

| Mode             | Model                       | Trigger                                 | Why                             |
|------------------|-----------------------------|-----------------------------------------|---------------------------------|
| Quick summary    | `claude-3-5-haiku`          | On session save                         | Cheap, fast, every save calls it|
| Deep insights    | `claude-3-5-sonnet`         | Insights tab (cached per session)       | Higher-quality structured recs  |

The deep insight is **cached in `sessions.ai_deep_insights`** so re-opening the page is free.
A "Re-run" button is available if the coach explicitly wants a fresh analysis.

### RAG (lightweight, no vector DB)

For this scale a vector store is overkill. `claude_service.retrieve_context()` pulls:

- player profile + intake notes
- last 7 days of health (sleep, HRV, soreness, hydration)
- last 5 game stat lines
- last 3 prior sessions

…and passes them as JSON inside a `<context>` block. The system prompt instructs Claude to
treat that block as the **only** source of truth, cite the field it used, and say "not enough
data" when context is missing.

---

## Running it

### 1. Add your Claude API key (gitignored)

```bash
cd backend
cp .env.example .env
# open .env and paste your real key into ANTHROPIC_API_KEY=
```

The `.env` file is in `.gitignore` and will never be committed.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed_data.py            # creates hoops.db with 2 demo players
uvicorn main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>

### 3. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

The Vite dev server proxies `/api/*` → `http://localhost:8000`, so you don't need to think
about CORS.

---

## Using the app

1. **Login** with `jstar` / `demo` (or `mrise` / `demo`).
   - Or click **View Demo** to be walked through the whole flow automatically.
2. **Past Info tab** — intake/medical notes, career snapshot, last 10 games, 14 days of health.
3. **Live Session tab** — three sections per the spec:
   1. **Coach Notes** (free text)
   2. **Base Data** (shots, sprints, HR, RPE, pain flags) — live FG% computed on screen
   3. **AI Recommendation** — Claude Haiku gives 4–6 grounded bullets after you hit save
4. **Insights tab** — deep Claude Sonnet analysis with sections for strengths, weaknesses,
   load/health signals, injury caution, and the recommended next 3 sessions. Cached.

---

## Optional: real Kaggle data

The seed will auto-import a few rows if you place the Kaggle basketball CSV at
`backend/data/games.csv`. It's optional — the synthetic data is sufficient for the demo.

Dataset: <https://www.kaggle.com/datasets/wyattowalsh/basketball>

---

## Cost guardrails

- Claude is **only called on explicit user actions** (save session, open insights). Never on
  page mount or re-renders.
- The deep analysis is cached in SQLite per session.
- The quick summary uses Haiku and is capped at 400 tokens.
- The deep summary uses Sonnet and is capped at 1200 tokens.

---

## Security notes

- `.env`, `*.db`, `node_modules`, `.venv`, build output are all gitignored.
- The demo uses plaintext passwords in SQLite **only because it's a local hackathon demo** —
  do not ship as-is. For production: hash with `bcrypt`/`argon2`, add JWT sessions, and put
  the API behind HTTPS.

---

## Tech

- Python 3.10+, FastAPI, Uvicorn, Pydantic v2, SQLite, `anthropic` Python SDK
- Node 18+, Vite 5, React 18
- NBA-inspired theme: deep navy court, electric red accent, gold highlight, glass cards
