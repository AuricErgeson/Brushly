from datetime import datetime
from sqlmodel import SQLModel, Field


class BrushEvent(SQLModel, table=True):
    """One toothbrushing event."""
    __tablename__ = "brush_event"

    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.now)
    period: str  # "morning" | "evening"
