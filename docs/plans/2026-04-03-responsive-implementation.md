# Responsive Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make PixelCoder responsive across desktop, tablet, and mobile with a unified clean design (no CRT monitor frame).

**Architecture:** Replace the CRT monitor frame (screws, bezel, thick borders) with a clean topbar + panel layout. Add CSS media queries for tablet (768-1024px) and mobile (<768px). Mobile uses a 2-tab bottom bar (Screen/Journal). Calendar toggles via clickable day-label on mobile. No changes to admin area.

**Tech Stack:** Vanilla CSS media queries, minimal vanilla JS for tab switching + calendar toggle.

**Reference mock:** `mock/responsive-mock/index.html` + `mock/responsive-mock/style.css`

---

### Task 1: Update HTML — add topbar, tab bar, mobile calendar, day-toggle

**Files:**
- Modify: `src/web/public/index.html`

**Step 1: Replace index.html with responsive structure**

The current HTML has a `.frame` with screws, power LED, CRT monitor chrome. Replace with clean structure:

```html
<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PixelCoder</title>
<link rel="icon" type="image/png" href="/assets/icon.png">
<link rel="stylesheet" href="/css/frame.css">
</head>
<body>

<!-- Top bar — always visible -->
<div class="topbar">
  <div class="topbar-led" id="powerLed"></div>
  <span class="topbar-title">PIXELCODER</span>
</div>

<div class="frame">
  <!-- LEFT: CRT showing the Inner World -->
  <div class="crt-side" data-tab="screen">
    <iframe
      id="crtFrame"
      class="crt-iframe"
      sandbox="allow-scripts allow-same-origin allow-forms"
      src="/render/latest"
      title="Inner World"
    ></iframe>
  </div>

  <!-- DIVIDER -->
  <div class="divider"></div>

  <!-- RIGHT: Workspace -->
  <div class="work-side" data-tab="journal">
    <!-- Calendar (desktop: always visible, tablet: compact nav, mobile: hidden) -->
    <div class="calendar-widget" id="calendarWidget">
      <div class="date-nav-compact" id="dateNavCompact"></div>
      <div class="calendar-full" id="calendarFull"></div>
    </div>

    <!-- Journal -->
    <div class="diary-section" id="diary">
      <!-- Mobile: clickable day label that toggles calendar -->
      <div class="journal-day-toggle" id="dayToggle">
        <button class="day-toggle-btn" id="dayToggleBtn">
          <span class="day-toggle-label" id="dayToggleLabel">DAG 1</span>
          <svg class="day-toggle-chevron" id="dayChevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      <!-- Mobile inline calendar (hidden by default) -->
      <div class="mobile-calendar" id="mobileCalendar"></div>

      <div id="journalEntries"></div>
    </div>

    <!-- Code + Character -->
    <div class="bottom-area">
      <div class="code-box">
        <div class="code-content" id="codeContent"></div>
      </div>
      <div class="character-area">
        <button class="debug-btn" id="btnDebug">RND</button>
        <video id="player" muted playsinline autoplay></video>
      </div>
    </div>
  </div>
</div>

<!-- Mobile tab bar (hidden on desktop/tablet) -->
<div class="tab-bar" id="tabBar">
  <button class="tab active" data-target="screen">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    <span>Screen</span>
  </button>
  <button class="tab" data-target="journal">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    <span>Journal</span>
  </button>
</div>

<script type="module" src="/js/app.js"></script>
</body>
</html>
```

Key changes from current HTML:
- Removed: `.screw` divs (4x), `.power-led` (replaced by `.topbar-led`)
- Added: `.topbar` (was `.mobile-topbar`), `.tab-bar` with 2 tabs, `.journal-day-toggle`, `.mobile-calendar`, `.date-nav-compact`
- Renamed: `powerLed` id moved from `.power-led` to `.topbar-led`
- Kept: iframe, `#calendarWidget`, `#diary`, `#journalEntries`, `#codeContent`, `#player`, `#btnDebug` — all JS hooks unchanged

**Step 2: Verify the HTML compiles / loads**

Open `http://localhost:3000` (or run `npm run dev:web`) and confirm the page loads without console errors. It will look broken until CSS is updated — that's expected.

**Step 3: Commit**

```bash
git add src/web/public/index.html
git commit -m "feat: update HTML structure for responsive layout"
```

---

### Task 2: Rewrite frame.css — unified clean design with responsive breakpoints

**Files:**
- Modify: `src/web/public/css/frame.css`

**Step 1: Replace frame.css with the responsive stylesheet**

Replace the entire file. The new CSS is based on `mock/responsive-mock/style.css` but adapted for production (uses real iframe instead of mock content, real video player instead of SVG placeholder).

Key sections:
1. **CSS variables** — add `--bg-surface` and `--border`, remove shell/bezel vars
2. **Topbar** — always visible, fixed top, LED + title
3. **Frame** — clean container, `position: fixed; top: 44px`, no borders/shadows/screws
4. **Divider** — 1px line, no pseudo-element handle
5. **CRT side** — `border-radius: 8px; margin: 8px`
6. **Work side** — `width: 400px; margin: 8px`
7. **Calendar, journal, bottom-area, character-area** — keep existing styles but with slightly adjusted padding
8. **Mobile-only elements** — `.tab-bar`, `.journal-day-toggle`, `.mobile-calendar` hidden by default (`display: none`)
9. **Tablet media query (max-width: 1024px)** — work-side 300px, compact date nav, hide code-box, character full-width
10. **Mobile media query (max-width: 767px)** — tab bar visible, panels absolute-positioned and toggled via `body[data-active-tab]`, calendar-widget hidden, day-toggle visible, code-box hidden, character strip horizontal

Important production differences from mock:
- `.crt-iframe` styles remain (the mock used a div, production uses iframe)
- `.debug-btn` styles remain
- `video` element styles remain (the mock used SVG)
- No `.mock-crt` or `.ms-*` classes needed (those are only in the mock for fake CRT content)

```css
@import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=VT323&family=Press+Start+2P&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #111A23;
  --bg-surface: #0d1520;
  --crt-bg: #0a0f0a;
  --crt-green: #33ff66;
  --crt-green-dim: rgba(51, 255, 102, .12);
  --crt-green-mid: rgba(51, 255, 102, .5);
  --amber: #d4a054;
  --amber-dim: rgba(212, 160, 84, .4);
  --border: rgba(255,255,255,.06);
  --pixel-font: 'Silkscreen', monospace;
  --terminal-font: 'VT323', monospace;
  --retro-font: 'Press Start 2P', monospace;
}

html, body {
  height: 100%;
  background: var(--bg);
  font-family: var(--pixel-font);
  overflow: hidden;
}
```

Refer to `mock/responsive-mock/style.css` for the complete CSS — translate each section, skipping `.mock-crt` and `.ms-*` rules, and keeping these production-only rules:

- `.crt-iframe` — `flex: 1; border: none; width: 100%; height: 100%; background: var(--crt-bg);`
- `.debug-btn` — keep existing styles from current `frame.css:388-406`
- `.character-area video` — `width: 170px; height: 170px; object-fit: contain; display: block;` (tablet: 120x120, mobile: 56x56)

**Step 2: Verify desktop layout**

Open the page in a desktop-width browser. Confirm:
- Topbar with LED + PIXELCODER visible at top
- CRT iframe on the left with rounded corners and margin
- Subtle 1px divider
- Work-side on the right (calendar, journal, code+character)
- No screws, no bezel, no thick borders

**Step 3: Verify tablet layout**

Resize browser to ~900px width. Confirm:
- Work-side narrows to 300px
- Calendar switches to compact `< DAG X >` nav
- Code-box hidden
- Character centered, full width of work-side

**Step 4: Verify mobile layout**

Resize to ~400px. Confirm:
- Top bar visible
- Bottom tab bar with Screen / Journal
- Screen tab shows CRT iframe fullscreen
- Journal tab shows character strip + day toggle + journal entries
- Code-box hidden

**Step 5: Commit**

```bash
git add src/web/public/css/frame.css
git commit -m "feat: responsive CSS — clean topbar, tablet/mobile breakpoints"
```

---

### Task 3: Add tab switching JS in app.js

**Files:**
- Modify: `src/web/public/js/app.js`

**Step 1: Add tab switching logic at end of boot()**

After the existing SSE setup in `boot()`, add:

```javascript
// --- Mobile tab switching ---
document.querySelectorAll('.tab-bar .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.body.dataset.activeTab = tab.dataset.target;
  });
});
```

This sets `data-active-tab` on `<body>`, which CSS uses to show/hide panels.

**Step 2: Add mobile calendar toggle logic**

After tab switching, add:

```javascript
// --- Mobile: day label toggles inline calendar ---
const dayToggleBtn = document.getElementById('dayToggleBtn');
const mobileCalendar = document.getElementById('mobileCalendar');
const dayChevron = document.getElementById('dayChevron');

if (dayToggleBtn) {
  let calendarOpen = false;

  dayToggleBtn.addEventListener('click', () => {
    calendarOpen = !calendarOpen;
    mobileCalendar.classList.toggle('open', calendarOpen);
    dayChevron.style.transform = calendarOpen ? 'rotate(180deg)' : '';
  });
}
```

**Step 3: Verify tab switching works**

In mobile viewport:
- Click "Journal" tab → CRT hides, work-side shows
- Click "Screen" tab → CRT shows, work-side hides
- Click "DAG X" button → mobile calendar toggles open/closed

**Step 4: Commit**

```bash
git add src/web/public/js/app.js
git commit -m "feat: add mobile tab switching and calendar toggle"
```

---

### Task 4: Update calendar.js — add compact mode + mobile calendar rendering

**Files:**
- Modify: `src/web/public/js/calendar.js`

**Step 1: Add compact date nav rendering**

The calendar module currently only renders the full 7-column grid into `#calendarWidget`. It needs to also:

1. Render a compact `< DAG X >` nav into `.date-nav-compact` (visible on tablet)
2. Render a calendar grid into `#mobileCalendar` (visible on mobile when toggled)
3. When a day is clicked in mobile calendar: close the calendar, update the day-toggle label, filter journal, and update CRT iframe

Update `renderCalendar()` to also call `renderCompactNav()` and `renderMobileCalendar()`:

```javascript
function renderCompactNav() {
  const nav = document.getElementById('dateNavCompact');
  if (!nav) return;

  const today = new Date();
  const todayDayNum = dayNumberFromDate(today);

  nav.innerHTML = `
    <button class="dn-prev" id="compactPrev">&lt;</button>
    <span class="dn-label" id="compactLabel">DAG ${todayDayNum}</span>
    <button class="dn-next" id="compactNext">&gt;</button>
  `;

  let currentDay = todayDayNum;

  nav.querySelector('#compactPrev').addEventListener('click', () => {
    currentDay = Math.max(1, currentDay - 1);
    nav.querySelector('#compactLabel').textContent = `DAG ${currentDay}`;
    filterByDay(currentDay);
  });
  nav.querySelector('#compactNext').addEventListener('click', () => {
    const maxDay = dayNumberFromDate(new Date());
    currentDay = Math.min(maxDay, currentDay + 1);
    nav.querySelector('#compactLabel').textContent = `DAG ${currentDay}`;
    filterByDay(currentDay);
  });
}
```

For mobile calendar: render same grid as desktop into `#mobileCalendar`, but add click handler that also closes the calendar and updates the day-toggle label:

```javascript
function renderMobileCalendar() {
  const container = document.getElementById('mobileCalendar');
  if (!container) return;

  // Render same calendar grid structure as desktop
  // (reuse same HTML generation from renderCalendar)

  container.querySelectorAll('.calendar-day[data-day]').forEach(el => {
    el.addEventListener('click', () => {
      const dayNum = parseInt(el.dataset.day);
      if (dayNum < 1) return;

      // Update active
      container.querySelectorAll('.calendar-day.active').forEach(a => a.classList.remove('active'));
      el.classList.add('active');

      // Update day toggle label
      const label = document.getElementById('dayToggleLabel');
      if (label) label.textContent = `DAG ${dayNum}`;

      // Close mobile calendar
      container.classList.remove('open');
      const chevron = document.getElementById('dayChevron');
      if (chevron) chevron.style.transform = '';

      // Filter journal
      if (calendarData[dayNum]) {
        filterByDay(dayNum);
      }
    });
  });
}
```

Also update the day-toggle label on init to show current day number:

```javascript
// In initCalendar, after setting startDate:
const label = document.getElementById('dayToggleLabel');
if (label) {
  const todayNum = dayNumberFromDate(new Date());
  label.textContent = `DAG ${todayNum}`;
}
```

**Step 2: Verify calendar works on all breakpoints**

- Desktop: full 7-col grid, click day filters journal + updates CRT
- Tablet: compact `< DAG X >` nav, arrows navigate days
- Mobile: tap "DAG X" → calendar slides open, tap a day → calendar closes, journal filters

**Step 3: Commit**

```bash
git add src/web/public/js/calendar.js
git commit -m "feat: calendar compact mode + mobile toggle calendar"
```

---

### Task 5: Visual polish and edge cases

**Files:**
- Modify: `src/web/public/css/frame.css` (minor tweaks)

**Step 1: Test SSE updates on mobile**

Trigger a cycle (or use admin panel). Verify:
- LED in topbar flashes amber on new revision (update the LED selector in `app.js` — it now uses `.topbar-led` instead of `.power-led`)
- Journal entry appears with animation even on Journal tab
- CRT iframe reloads even when on Journal tab (so it's ready when switching back to Screen)

**Step 2: Fix LED flash selector in app.js**

The current SSE handler references `document.getElementById('powerLed')` which still works since we kept `id="powerLed"` on the `.topbar-led`. Verify this selector still resolves. If the id was changed, update the reference.

**Step 3: Test scroll behavior**

- Mobile journal tab: scroll through entries, verify infinite scroll still triggers
- Desktop: verify journal scroll still works in narrower work-side

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: polish responsive edge cases — LED, scroll, SSE"
```

---

### Task 6: Final verification across breakpoints

**Step 1: Test at exact breakpoints**

Test at these widths:
- 1440px (desktop, wide)
- 1024px (breakpoint edge)
- 900px (tablet)
- 768px (breakpoint edge)
- 414px (iPhone-ish)
- 375px (narrow phone)

**Step 2: Test interactions at each breakpoint**

At each width verify:
- Calendar navigation works
- Journal entries load and scroll
- Character animation plays
- SSE updates work
- No horizontal overflow
- No elements cut off

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: responsive layout adjustments after cross-device testing"
```
