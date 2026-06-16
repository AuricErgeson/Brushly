from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).parent / "brushly.db"
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:

    from models import BrushEvent

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
