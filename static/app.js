/* Brushly — vanilla JS frontend */
(() => {
  "use strict";

  const API = "/api";

  const el = {
    streakCount: document.querySelector('[data-testid="streak-count"]'),
    morningBtn: document.querySelector('[data-testid="brush-morning-btn"]'),
    eveningBtn: document.querySelector('[data-testid="brush-evening-btn"]'),
    prevBtn: document.querySelector('[data-testid="prev-month-btn"]'),
    nextBtn: document.querySelector('[data-testid="next-month-btn"]'),
    title: document.querySelector('[data-testid="calendar-title"]'),
    grid: document.querySelector('[data-testid="calendar-grid"]'),
    toast: document.getElementById("toast"),
  };

  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth() + 1; // 1-12

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async function refreshStreak() {
    try {
      const data = await api("/streak");
      el.streakCount.textContent = String(data.streak ?? 0);
    } catch (err) {
      console.error("streak error", err);
    }
  }

  async function refreshCalendar() {
    el.title.textContent = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`;
    el.grid.innerHTML = "";

    let events = [];
    try {
      events = await api(`/history?year=${viewYear}&month=${viewMonth}`);
    } catch (err) {
      console.error("history error", err);
    }

    // count brushes per day-of-month
    const counts = new Map();
    for (const e of events) {
      const d = new Date(e.timestamp);
      // Use local date components matching the viewed month/year
      if (d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth) {
        const day = d.getDate();
        counts.set(day, (counts.get(day) || 0) + 1);
      }
    }

    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

    // leading blanks
    for (let i = 0; i < firstDow; i++) {
      const blank = document.createElement("div");
      blank.className = "day empty";
      el.grid.appendChild(blank);
    }

    const isCurrentMonth =
      today.getFullYear() === viewYear && today.getMonth() + 1 === viewMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      const c = counts.get(d) || 0;
      const level = c === 0 ? 0 : c === 1 ? 1 : 2;
      cell.className = `day level-${level}`;
      cell.dataset.testid = `day-${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cell.dataset.count = String(c);
      cell.textContent = String(d);
      cell.title = `${MONTH_NAMES[viewMonth - 1]} ${d}: ${c} brush${c === 1 ? "" : "es"}`;
      if (isCurrentMonth && d === today.getDate()) cell.classList.add("today");
      el.grid.appendChild(cell);
    }
  }

  async function logBrush(period, btn) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy");
    try {
      await api("/brush", {
        method: "POST",
        body: JSON.stringify({ period }),
      });
      toast(period === "morning" ? "Morning brush logged ✨" : "Evening brush logged ✨");
      // Jump the calendar view to current month so the new dot shows.
      viewYear = today.getFullYear();
      viewMonth = today.getMonth() + 1;
      await Promise.all([refreshStreak(), refreshCalendar()]);
    } catch (err) {
      console.error(err);
      toast("Couldn't save brush. Try again.");
    } finally {
      btn.classList.remove("is-busy");
    }
  }

  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    viewMonth = m;
    viewYear = y;
    refreshCalendar();
  }

  el.morningBtn.addEventListener("click", () => logBrush("morning", el.morningBtn));
  el.eveningBtn.addEventListener("click", () => logBrush("evening", el.eveningBtn));
  el.prevBtn.addEventListener("click", () => shiftMonth(-1));
  el.nextBtn.addEventListener("click", () => shiftMonth(1));

  // initial load
  refreshStreak();
  refreshCalendar();
})();
