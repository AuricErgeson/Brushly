"""Backend regression tests for Brushly API."""
import os
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to public URL from /app/frontend/.env when env not exported
    BASE_URL = "https://floss-flow.preview.emergentagent.com"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- POST /api/brush ----------
class TestBrushPost:
    def test_post_morning_ok(self, client):
        r = client.post(f"{BASE_URL}/api/brush", json={"period": "morning"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and isinstance(data["id"], int)
        assert data["period"] == "morning"
        assert "timestamp" in data
        # timestamp parseable
        datetime.fromisoformat(data["timestamp"])

    def test_post_evening_ok(self, client):
        r = client.post(f"{BASE_URL}/api/brush", json={"period": "evening"})
        assert r.status_code == 200, r.text
        assert r.json()["period"] == "evening"

    def test_post_invalid_period_422(self, client):
        r = client.post(f"{BASE_URL}/api/brush", json={"period": "noon"})
        assert r.status_code == 422, r.text

    def test_post_empty_body_422(self, client):
        r = client.post(f"{BASE_URL}/api/brush", json={})
        assert r.status_code == 422, r.text


# ---------- GET /api/streak ----------
class TestStreak:
    def test_streak_after_today_brush(self, client):
        # Ensure at least one brush today
        client.post(f"{BASE_URL}/api/brush", json={"period": "morning"})
        r = client.get(f"{BASE_URL}/api/streak")
        assert r.status_code == 200
        data = r.json()
        assert "streak" in data
        assert data["streak"] >= 1

    def test_streak_per_day_not_per_event(self, client):
        # Log a second brush today - streak should remain the same
        r1 = client.get(f"{BASE_URL}/api/streak")
        s1 = r1.json()["streak"]
        client.post(f"{BASE_URL}/api/brush", json={"period": "evening"})
        r2 = client.get(f"{BASE_URL}/api/streak")
        s2 = r2.json()["streak"]
        assert s1 == s2, f"Streak changed per event: {s1} -> {s2}"


# ---------- GET /api/history ----------
class TestHistory:
    def test_history_current_month_contains_event(self, client):
        # Ensure at least one event exists today
        client.post(f"{BASE_URL}/api/brush", json={"period": "morning"})
        now = datetime.now()
        r = client.get(f"{BASE_URL}/api/history", params={"year": now.year, "month": now.month})
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)
        assert len(events) >= 1
        e = events[0]
        assert "id" in e and "timestamp" in e and "period" in e

    def test_history_distant_month_empty(self, client):
        # 1971-01 should have no events (DB cleared before run)
        r = client.get(f"{BASE_URL}/api/history", params={"year": 1971, "month": 1})
        assert r.status_code == 200
        assert r.json() == []

    def test_history_invalid_month_400(self, client):
        r = client.get(f"{BASE_URL}/api/history", params={"year": 2026, "month": 13})
        assert r.status_code == 400
        assert "month must be between 1 and 12" in r.json().get("detail", "")

    def test_history_invalid_month_zero_400(self, client):
        r = client.get(f"{BASE_URL}/api/history", params={"year": 2026, "month": 0})
        assert r.status_code == 400


# ---------- Static / index ----------
class TestStaticPages:
    def test_root_returns_html_local(self):
        # In the preview env, public "/" is routed to a separate React container
        # (Kubernetes ingress only routes /api/* to FastAPI on :8001). So we hit
        # the backend directly on localhost:8001 to validate the FastAPI route.
        r = requests.get("http://localhost:8001/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "Brushly" in r.text

    def test_api_root_returns_html(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "Brushly" in r.text

    def test_static_css(self, client):
        r = client.get(f"{BASE_URL}/api/static/style.css")
        assert r.status_code == 200
        assert "text/css" in r.headers.get("content-type", "")

    def test_static_js(self, client):
        r = client.get(f"{BASE_URL}/api/static/app.js")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "javascript" in ct or "ecmascript" in ct
