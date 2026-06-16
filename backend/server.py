"""Shim used by the supervisor in this preview environment.

The canonical project lives at the repo root (see /app/main.py). Supervisor
expects `server:app` inside `/app/backend`, so we expose the same FastAPI app
from here without duplicating any code.
"""
import sys
from pathlib import Path

# Make the canonical app importable.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from main import app  # noqa: E402, F401  (re-exported for uvicorn)
