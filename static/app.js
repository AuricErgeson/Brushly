/* Brushly — vanilla JS frontend */
(() => {
  "use strict";

  const API = "/api";

  const el = {
    streakCount: document.querySelector('[data-testid="streak-count"]'),
    bestStreakCount: document.querySelector('[data-testid="best-streak-count"]'),
    morningBtn: document.querySelector('[data-testid="brush-morning-btn"]'),
    eveningBtn: document.querySelector('[data-testid="brush-evening-btn"]'),
    prevBtn: document.querySelector('[data-testid="prev-month-btn"]'),
    nextBtn: document.querySelector('[data-testid="next-month-btn"]'),
    title: document.querySelector('[data-testid="calendar-title"]'),
    grid: document.querySelector('[data-testid="calendar-grid"]'),
    toast: document.getElementById("toast"),
    weeklyValue: document.querySelector('[data-testid="stat-weekly-value"]'),
    weeklyBar: document.querySelector('[data-testid="stat-weekly-bar"]'),
    splitMorning: document.querySelector('[data-testid="stat-split-morning"]'),
    splitMorningPct: document.querySelector('[data-testid="stat-split-morning-pct"]'),
    splitEvening: document.querySelector('[data-testid="stat-split-evening"]'),
    splitEveningPct: document.querySelector('[data-testid="stat-split-evening-pct"]'),
    monthValue: document.querySelector('[data-testid="stat-month-value"]'),
    monthBar: document.querySelector('[data-testid="stat-month-bar"]'),
    monthDetail: document.querySelector('[data-testid="stat-month-detail"]'),
    trendGraph: document.querySelector('[data-testid="trend-graph"]'),
    milestoneRow: document.querySelector('[data-testid="milestone-row"]'),
    milestoneTotal: document.querySelector('[data-testid="milestone-total"]'),
    popupOverlay: document.querySelector('[data-testid="brush-popup-overlay"]'),
    popupTitle: document.querySelector('[data-testid="brush-popup-title"]'),
    popupList: document.querySelector('[data-testid="brush-popup-list"]'),
    popupClose: document.querySelector('[data-testid="brush-popup-close"]'),
    exportBtn: document.querySelector('[data-testid="export-btn"]'),
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

  function animateCounter(el, from, to, duration = 600) {
    const diff = to - from;
    if (diff === 0) { el.textContent = String(to); return; }
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + diff * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateDailyRing(count) {
    const fill = document.querySelector(".daily-ring-fill");
    const label = document.querySelector("[data-testid='daily-ring-label']");
    if (!fill || !label) return;
    const circumference = 100.5;
    fill.style.strokeDashoffset = String(circumference - (Math.min(count, 2) / 2) * circumference);
    label.textContent = `${Math.min(count, 2)}/2`;
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
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- Streak ----------
  async function refreshStreak(bump = false) {
    try {
      const data = await api("/streak");
      const next = data.streak ?? 0;
      const prev = parseInt(el.streakCount.textContent, 10) || 0;
      animateCounter(el.streakCount, prev, next);
      if (bump && next > prev) {
        el.streakCount.classList.remove("streak-bump");
        void el.streakCount.offsetWidth;
        el.streakCount.classList.add("streak-bump");
      }
    } catch (err) {
      console.error("streak error", err);
    }
  }

  // ---------- Calendar ----------
  async function refreshCalendar() {
    el.title.textContent = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`;
    el.grid.innerHTML = "";

    let events = [];
    try {
      events = await api(`/history?year=${viewYear}&month=${viewMonth}`);
    } catch (err) {
      console.error("history error", err);
    }

    const counts = new Map();
    for (const e of events) {
      const d = new Date(e.timestamp);
      if (d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth) {
        const day = d.getDate();
        counts.set(day, (counts.get(day) || 0) + 1);
      }
    }

    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

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
      if (c > 0) {
        cell.classList.add("has-brushes");
        cell.dataset.date = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cell.addEventListener("click", () => showDayBrushes(cell.dataset.date));
      }
      cell.dataset.testid = `day-${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cell.dataset.count = String(c);
      cell.textContent = String(d);
      cell.title = `${MONTH_NAMES[viewMonth - 1]} ${d}: ${c} brush${c === 1 ? "" : "es"}`;
      if (isCurrentMonth && d === today.getDate()) cell.classList.add("today");
      el.grid.appendChild(cell);
    }
  }

  // ---------- Today Status ----------
  async function refreshTodayStatus() {
    const yy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    try {
      const brushes = await api(`/brushes/${yy}-${mm}-${dd}`);
      const hasMorning = brushes.some(b => b.period === "morning");
      const hasEvening = brushes.some(b => b.period === "evening");
      el.morningBtn.classList.toggle("is-done", hasMorning);
      el.eveningBtn.classList.toggle("is-done", hasEvening);
      updateDailyRing((hasMorning ? 1 : 0) + (hasEvening ? 1 : 0));
    } catch (err) {
      console.error("today status error", err);
    }
  }

  // ---------- Log Brush ----------
  async function logBrush(period, btn) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy");
    try {
      await api("/brush", {
        method: "POST",
        body: JSON.stringify({ period }),
      });
      toast(period === "morning" ? "Morning brush logged" : "Evening brush logged");
      navigator.vibrate?.(80);
      viewYear = today.getFullYear();
      viewMonth = today.getMonth() + 1;
      await Promise.all([refreshStreak(true), refreshCalendar(), refreshInsights(), refreshTodayStatus()]);
    } catch (err) {
      console.error(err);
      toast("Couldn't save brush. Try again.");
    } finally {
      btn.classList.remove("is-busy");
    }
  }

  // ---------- Month Navigation ----------
  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    viewMonth = m;
    viewYear = y;
    refreshCalendar();
  }

  // ---------- Insights ----------
  async function refreshInsights() {
    try {
      const data = await api("/insights");
      renderStats(data);
      renderTrend(data.trend);
      renderMilestones(data.milestones);
      if (el.bestStreakCount) {
        el.bestStreakCount.textContent = String(data.milestones.best_streak);
      }
    } catch (err) {
      console.error("insights error", err);
    }
  }

  function renderStats(data) {
    // Weekly
    if (el.weeklyValue && el.weeklyBar) {
      el.weeklyValue.textContent = `${data.weekly.completed}/${data.weekly.target}`;
      el.weeklyBar.style.width = `${data.weekly.rate * 100}%`;
    }

    // Split
    if (el.splitMorning && el.splitMorningPct) {
      el.splitMorning.style.width = `${data.split.morning * 100}%`;
      el.splitMorningPct.textContent = `${Math.round(data.split.morning * 100)}%`;
    }
    if (el.splitEvening && el.splitEveningPct) {
      el.splitEvening.style.width = `${data.split.evening * 100}%`;
      el.splitEveningPct.textContent = `${Math.round(data.split.evening * 100)}%`;
    }

    // Month
    if (el.monthValue && el.monthBar && el.monthDetail) {
      el.monthValue.textContent = `${Math.round(data.month.rate * 100)}%`;
      el.monthBar.style.width = `${data.month.rate * 100}%`;
      el.monthDetail.textContent = `${data.month.full_days} of ${data.month.total_days} days complete`;
    }
  }

  // ---------- Trend Graph (Pure SVG) ----------
  function renderTrend(trend) {
    if (!el.trendGraph) return;

    const container = el.trendGraph;
    const W = container.clientWidth || 400;
    const H = container.clientHeight || 120;
    const pad = { top: 12, right: 8, bottom: 20, left: 24 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const maxVal = Math.max(2, ...trend.map(t => t.count));
    const yStep = maxVal <= 2 ? 1 : maxVal <= 4 ? 1 : 2;

    function x(i) { return pad.left + (i / (trend.length - 1)) * cw; }
    function y(v) { return pad.top + ch - (v / maxVal) * ch; }

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,212,164,0.25)"/>
      <stop offset="100%" stop-color="rgba(0,212,164,0)"/>
    </linearGradient></defs>`;

    // Grid lines
    for (let v = 0; v <= maxVal; v += yStep) {
      svg += `<line class="grid-line" x1="${pad.left}" y1="${y(v)}" x2="${W - pad.right}" y2="${y(v)}"/>`;
      svg += `<text class="axis-label" x="${pad.left - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    }

    // Area fill
    let areaD = `M${x(0)},${y(0)}`;
    for (let i = 0; i < trend.length; i++) {
      areaD += ` L${x(i)},${y(trend[i].count)}`;
    }
    areaD += ` L${x(trend.length - 1)},${y(0)} Z`;
    svg += `<path class="area-fill" d="${areaD}"/>`;

    // Line
    let lineD = `M${x(0)},${y(trend[0].count)}`;
    for (let i = 1; i < trend.length; i++) {
      lineD += ` L${x(i)},${y(trend[i].count)}`;
    }
    svg += `<path class="line-path" d="${lineD}"/>`;

    // Dots
    for (let i = 0; i < trend.length; i++) {
      const cls = trend[i].count === 0 ? "dot-zero" : "dot";
      const r = trend[i].count === 0 ? 2 : 3;
      svg += `<circle class="${cls}" cx="${x(i)}" cy="${y(trend[i].count)}" r="${r}"/>`;
    }

    // X-axis labels (every 7 days)
    for (let i = 0; i < trend.length; i += 7) {
      const d = new Date(trend[i].date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      svg += `<text class="axis-label" x="${x(i)}" y="${H - 2}" text-anchor="middle">${label}</text>`;
    }

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  // ---------- Milestones ----------
  function renderMilestones(milestones) {
    if (!el.milestoneRow) return;

    el.milestoneTotal.textContent = `${milestones.total_brushes} total brushes`;

    const badges = el.milestoneRow.querySelectorAll(".milestone-badge");
    badges.forEach(badge => {
      const threshold = parseInt(badge.dataset.milestone, 10);
      const unlocked = milestones.unlocked.includes(threshold);
      badge.classList.toggle("is-unlocked", unlocked);
    });
  }

  // ---------- Brush Popup (Delete) ----------
  function showDayBrushes(dateStr) {
    api(`/brushes/${dateStr}`)
      .then(brushes => {
        const d = new Date(dateStr + "T00:00:00");
        el.popupTitle.textContent = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

        if (!brushes.length) {
          el.popupList.innerHTML = `<div class="brush-empty">No brushes logged this day.</div>`;
        } else {
          el.popupList.innerHTML = brushes.map(b => {
            const time = new Date(b.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const periodClass = b.period === "morning" ? "brush-period-badge--morning" : "brush-period-badge--evening";
            return `<div class="brush-list-item" data-brush-id="${b.id}">
              <div class="brush-list-info">
                <span class="brush-period-badge ${periodClass}">${b.period}</span>
                <span class="brush-time">${time}</span>
              </div>
              <button class="btn-delete" data-delete-id="${b.id}" type="button" aria-label="Delete brush">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 4 14 4"/><path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="6" y1="7" x2="6" y2="13"/><line x1="10" y1="7" x2="10" y2="13"/></svg>
              </button>
            </div>`;
          }).join("");

          el.popupList.querySelectorAll(".btn-delete").forEach(btn => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const id = parseInt(btn.dataset.deleteId, 10);
              deleteBrush(id);
            });
          });
        }

        el.popupOverlay.classList.add("show");
      })
      .catch(err => {
        console.error("brushes error", err);
        toast("Couldn't load brushes for this day.");
      });
  }

  function closePopup() {
    el.popupOverlay.classList.remove("show");
  }

  async function deleteBrush(id) {
    try {
      await api(`/brush/${id}`, { method: "DELETE" });
      toast("Brush deleted");
      closePopup();
      await Promise.all([refreshStreak(), refreshCalendar(), refreshInsights(), refreshTodayStatus()]);
    } catch (err) {
      console.error("delete error", err);
      toast("Couldn't delete brush. Try again.");
    }
  }

  // ---------- Export ----------
  function exportData() {
    window.open(`${API}/export`, "_blank");
    toast("Export started");
  }

  // ---------- Event Listeners ----------
  el.morningBtn.addEventListener("click", () => logBrush("morning", el.morningBtn));
  el.eveningBtn.addEventListener("click", () => logBrush("evening", el.eveningBtn));
  el.prevBtn.addEventListener("click", () => shiftMonth(-1));
  el.nextBtn.addEventListener("click", () => shiftMonth(1));
  el.popupClose.addEventListener("click", closePopup);
  el.popupOverlay.addEventListener("click", (e) => {
    if (e.target === el.popupOverlay) closePopup();
  });
  el.exportBtn.addEventListener("click", exportData);

  // Keyboard: Escape closes popup
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });

  // Swipe to navigate calendar (mobile)
  let touchStartX = 0;
  const calCard = document.querySelector(".calendar-card");
  calCard.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  calCard.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) shiftMonth(dx < 0 ? 1 : -1);
  });

  // initial load
  refreshStreak();
  refreshCalendar();
  refreshInsights();
  refreshTodayStatus();
})();
