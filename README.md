# Brushly 🪥

A tiny, local-first **toothbrushing habit tracker**. Tap *Morning* or *Evening*, watch your streak climb, and see the month at a glance.

> Your data stays local. No cloud, no account.

## What the app does

- Logs each brush with a single tap (`Morning 🌅` / `Evening 🌙`)
- Tracks your **current streak** — consecutive days with at least one brush
- Shows a **calendar grid** for any month, colored by how many times you brushed each day:
  - **grey** — 0
  - **light blue** — 1
  - **dark blue** — 2 or more
- Browse history with prev/next month controls
- All data persists in a local SQLite file (`brushly.db`)

## Requirements

- Python **3.10+**

## Setup

```bash
git clone <this-repo> brushly
cd brushly
pip install -r requirements.txt
python main.py
```

Then open <http://localhost:8000> in your browser.

That's it. No env vars, no accounts, no internet required.

## Project structure

```
brushly/
├── main.py              # FastAPI app: /api endpoints + serves the frontend
├── models.py            # SQLModel: BrushEvent
├── database.py          # SQLite engine & session
├── static/
│   ├── index.html       # The single-page UI
│   ├── style.css
│   └── app.js
├── requirements.txt
├── README.md
└── .gitignore
```

## API

Base URL: `/api`

| Method | Path                              | Description                                                  |
|-------:|-----------------------------------|--------------------------------------------------------------|
| POST   | `/api/brush`                      | Log a brush. Body: `{ "period": "morning" \| "evening" }`    |
| GET    | `/api/history?year=YYYY&month=MM` | All brush events for that month                              |
| GET    | `/api/streak`                     | `{ "streak": <int> }` — consecutive days with at least 1 brush |

## A note on your data

Brushly stores everything in a single SQLite file next to `main.py` (`brushly.db`).
Back it up, sync it, or delete it — it's yours.
