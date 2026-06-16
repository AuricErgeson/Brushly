from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select

from database import engine, get_session, init_db
from models import BrushEvent

app = FastAPI(title="Brushly", description="A tiny toothbrushing habit tracker.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the schema on startup.
init_db()


# ---------- API ----------
api = APIRouter(prefix="/api")


class BrushIn(BaseModel):
    period: Literal["morning", "evening"]


class BrushOut(BaseModel):
    id: int
    timestamp: datetime
    period: str


class StreakOut(BaseModel):
    streak: int


@api.post("/brush", response_model=BrushOut)
def log_brush(body: BrushIn, session: Session = Depends(get_session)):
    event = BrushEvent(period=body.period)
    session.add(event)
    session.commit()
    session.refresh(event)
    return BrushOut(id=event.id, timestamp=event.timestamp, period=event.period)


@api.get("/history", response_model=list[BrushOut])
def history(year: int, month: int, session: Session = Depends(get_session)):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="month must be between 1 and 12")
    if year < 1970 or year > 9999:
        raise HTTPException(status_code=400, detail="year out of range")

    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    events = session.exec(
        select(BrushEvent)
        .where(BrushEvent.timestamp >= start, BrushEvent.timestamp < end)
        .order_by(BrushEvent.timestamp)
    ).all()

    return [BrushOut(id=e.id, timestamp=e.timestamp, period=e.period) for e in events]


@api.get("/streak", response_model=StreakOut)
def streak(session: Session = Depends(get_session)):
    events = session.exec(select(BrushEvent)).all()
    if not events:
        return StreakOut(streak=0)

    days = {e.timestamp.date() for e in events}

    today = date.today()
    cursor = today
    # Allow today to be in-progress: if no brush yet today, start from yesterday.
    if cursor not in days:
        cursor = cursor - timedelta(days=1)

    count = 0
    while cursor in days:
        count += 1
        cursor = cursor - timedelta(days=1)

    return StreakOut(streak=count)


app.include_router(api)


# ---------- Static frontend ----------
STATIC_DIR = Path(__file__).parent / "static"

# Mount static assets at two paths so it works both for local clone (port 8000,
# loaded from "/") and for hosted setups where everything must live under /api.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/api/static", StaticFiles(directory=STATIC_DIR), name="static_api")


def _index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/")
def root_index():
    return _index()


@app.get("/api")
def api_root():
    return _index()


@app.get("/api/")
def api_root_slash():
    return _index()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
