from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select, col, delete

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


class TrendPoint(BaseModel):
    date: str
    count: int


class WeeklyOut(BaseModel):
    completed: int
    target: int
    rate: float


class SplitOut(BaseModel):
    morning: float
    evening: float


class MonthOut(BaseModel):
    full_days: int
    total_days: int
    rate: float


class MilestoneOut(BaseModel):
    best_streak: int
    total_brushes: int
    unlocked: list[int]


class InsightsOut(BaseModel):
    trend: list[TrendPoint]
    weekly: WeeklyOut
    split: SplitOut
    month: MonthOut
    milestones: MilestoneOut
    current_streak: int


@api.post("/brush", response_model=BrushOut)
def log_brush(body: BrushIn, session: Session = Depends(get_session)):
    event = BrushEvent(period=body.period)
    session.add(event)
    session.commit()
    session.refresh(event)
    return BrushOut(id=event.id, timestamp=event.timestamp, period=event.period)


@api.delete("/brush/{brush_id}", status_code=204)
def delete_brush(brush_id: int, session: Session = Depends(get_session)):
    event = session.get(BrushEvent, brush_id)
    if not event:
        raise HTTPException(status_code=404, detail="Brush event not found")
    session.delete(event)
    session.commit()


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


def _calc_best_streak(events) -> int:
    if not events:
        return 0
    days = sorted({e.timestamp.date() for e in events})
    best = 1
    current = 1
    for i in range(1, len(days)):
        if days[i] - days[i - 1] == timedelta(days=1):
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best


@api.get("/insights", response_model=InsightsOut)
def insights(session: Session = Depends(get_session)):
    all_events = session.exec(select(BrushEvent)).all()
    today = date.today()

    # Current streak
    days_set = {e.timestamp.date() for e in all_events}
    cursor = today
    if cursor not in days_set:
        cursor = cursor - timedelta(days=1)
    current_streak = 0
    while cursor in days_set:
        current_streak += 1
        cursor = cursor - timedelta(days=1)

    # Best streak
    best_streak = _calc_best_streak(all_events)

    # Trend: last 30 days
    trend_start = today - timedelta(days=29)
    day_counts: dict[date, int] = {}
    for e in all_events:
        d = e.timestamp.date()
        if d >= trend_start:
            day_counts[d] = day_counts.get(d, 0) + 1
    trend = []
    for i in range(30):
        d = trend_start + timedelta(days=i)
        trend.append(TrendPoint(date=d.isoformat(), count=day_counts.get(d, 0)))

    # Weekly completion (Mon-Sun of current week)
    weekday = today.weekday()  # 0=Mon
    week_start = today - timedelta(days=weekday)
    week_end = week_start + timedelta(days=7)
    week_days = {
        e.timestamp.date()
        for e in all_events
        if week_start <= e.timestamp.date() < week_end
    }
    completed = len(
        week_days & {week_start + timedelta(days=i) for i in range(min(weekday + 1, 7))}
    )
    target = min(weekday + 1, 7)
    weekly = WeeklyOut(
        completed=completed, target=target, rate=completed / target if target else 0.0
    )

    # Morning vs Evening split (last 30 days)
    recent = [e for e in all_events if e.timestamp.date() >= trend_start]
    mornings = sum(1 for e in recent if e.period == "morning")
    evenings = sum(1 for e in recent if e.period == "evening")
    total_recent = len(recent) or 1
    split = SplitOut(
        morning=round(mornings / total_recent, 2),
        evening=round(evenings / total_recent, 2),
    )

    # Current month summary
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)
    month_days_in_period = (month_end - month_start).days
    # Only count days up to today
    days_so_far = today.day
    month_events = [
        e for e in all_events if month_start <= e.timestamp.date() < month_end
    ]
    month_day_counts: dict[date, int] = {}
    for e in month_events:
        month_day_counts[e.timestamp.date()] = (
            month_day_counts.get(e.timestamp.date(), 0) + 1
        )
    full_days = sum(1 for c in month_day_counts.values() if c >= 2)
    month = MonthOut(
        full_days=full_days,
        total_days=days_so_far,
        rate=round(full_days / days_so_far, 2) if days_so_far else 0.0,
    )

    # Milestones
    total_brushes = len(all_events)
    milestone_thresholds = [7, 30, 60, 100, 365]
    unlocked = [t for t in milestone_thresholds if best_streak >= t]

    milestones = MilestoneOut(
        best_streak=best_streak,
        total_brushes=total_brushes,
        unlocked=unlocked,
    )

    return InsightsOut(
        trend=trend,
        weekly=weekly,
        split=split,
        month=month,
        milestones=milestones,
        current_streak=current_streak,
    )


@api.get("/brushes/{date_str}")
def brushes_on_date(date_str: str, session: Session = Depends(get_session)):
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    start = datetime(target.year, target.month, target.day)
    end = start + timedelta(days=1)
    events = session.exec(
        select(BrushEvent).where(
            BrushEvent.timestamp >= start, BrushEvent.timestamp < end
        )
    ).all()
    return [BrushOut(id=e.id, timestamp=e.timestamp, period=e.period) for e in events]


@api.get("/export")
def export_data(session: Session = Depends(get_session)):
    events = session.exec(select(BrushEvent).order_by(BrushEvent.timestamp)).all()
    data = [
        {"id": e.id, "timestamp": e.timestamp.isoformat(), "period": e.period}
        for e in events
    ]
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": 'attachment; filename="brushly_export.json"'},
    )


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

    uvicorn.run(app)
