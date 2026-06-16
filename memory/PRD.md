# Brushly — PRD

## Original problem statement
Build a web app called [choose a good brand name] — a toothbrushing habit tracker.

**Stack**: FastAPI + SQLite (SQLModel), vanilla HTML/CSS/JS served by FastAPI, no auth, single user, local use only.

**Endpoints**:
- `POST /api/brush` — body `{ "period": "morning" | "evening" }`
- `GET /api/history?year=YYYY&month=MM` — events for that month
- `GET /api/streak` — current streak (consecutive days with ≥1 brush)

**DB**: `brush_event(id int pk, timestamp datetime, period str)`

**Frontend**: served at `/`, two big buttons, streak counter at top, calendar grid colored by brush count (0=grey, 1=light blue, 2+=dark blue), month nav, mobile-first, white bg + `#3B82F6` accents.

**Project structure**: `main.py`, `models.py`, `database.py`, `static/{index.html,style.css,app.js}`, `requirements.txt`, `README.md`, `.gitignore` (must include `*.db`).

## User personas
Solo user tracking their own brushing habit. No multi-user, no accounts.

## User choices (Feb 16, 2026)
- Strict spec adherence — FastAPI + SQLite + vanilla HTML/JS (no React)
- Brand name: **Brushly**
- Strictly per spec, no extras (no undo, no longest-streak record)

## Architecture / tasks done
- `/app/main.py` — FastAPI app, mounts `/static` and `/api/static`, serves `index.html` at both `/` (local) and `/api/` (preview ingress)
- `/app/models.py` — `BrushEvent` SQLModel (id, timestamp default `datetime.now`, period)
- `/app/database.py` — SQLite engine at `/app/brushly.db`, `init_db()`, `get_session()`
- `/app/static/` — `index.html`, `style.css`, `app.js` (vanilla JS, fetches `/api/*`)
- `/app/backend/server.py` — thin shim that imports `app` from `/app/main.py` so supervisor's `uvicorn server:app` works on port 8001
- `/app/requirements.txt` — `fastapi`, `uvicorn`, `sqlmodel`, `pydantic`
- `/app/README.md`, `/app/.gitignore` (`*.db` included)

## Core requirements (static)
1. Log brush events with period (morning/evening)
2. Show current streak (consecutive days with ≥1 brush)
3. Monthly calendar colored by daily brush count
4. Month navigation (prev/next)
5. Mobile-first, white bg, `#3B82F6` accents
6. SQLite persistence across restarts
7. Single-command clone-and-run

## What's been implemented (2026-02-16)
- ✅ All 3 API endpoints (`/api/brush`, `/api/history`, `/api/streak`)
- ✅ SQLite via SQLModel, schema auto-created on startup
- ✅ Single-page vanilla frontend with brand, streak card, two large action buttons, calendar grid, month nav, toast feedback, mobile-first responsive CSS
- ✅ Calendar coloring: level-0 (grey), level-1 (light blue), level-2 (dark blue), today outlined
- ✅ Streak logic with today-in-progress handling (if no brush today, count back from yesterday)
- ✅ README, .gitignore (`*.db`), requirements.txt
- ✅ Backend tests: 14/14 passing. Frontend Playwright tests: all critical flows passing (desktop + mobile 414x896, no horizontal overflow).

## Backlog (P0 / P1 / P2)
- **P1**: Timezone hardening — store UTC, compute "today" from client X-Timezone header so streak doesn't disagree with browser near midnight
- **P2**: Optional "undo last brush" button
- **P2**: Longest-streak record alongside current streak
- **P2**: PWA manifest + service worker for installable offline use
- **P2**: Light reminder notifications (browser Notification API)
- **P2**: CSV export of all events

## Notes
- In this preview env, the public URL serves the UI at `<REACT_APP_BACKEND_URL>/api/` because the K8s ingress routes `/` to an unused React container. The canonical clone-and-run flow per README uses `python main.py` → `http://localhost:8000/`.
