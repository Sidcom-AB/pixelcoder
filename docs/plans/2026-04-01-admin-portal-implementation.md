# Admin Developer Portal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the retro-styled admin page with a clean, light-themed developer backoffice portal with 6 tabbed sections for debugging, logs, revisions, token usage, app state, and settings.

**Architecture:** Static HTML/CSS/JS files served behind auth gate. Client-side tab switching with vanilla JS. All data fetched via JSON API endpoints. Auto-refresh on Dashboard tab every 15s.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Express API routes, PostgreSQL via Knex.

---

### Task 1: New API Endpoints

**Files:**
- Modify: `src/web/routes/admin.js`

**Step 1: Add GET /revisions endpoint**

Add after the existing `/logs` route (line ~69):

```javascript
router.get('/revisions', requireSecret, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const revisions = await db('revisions').orderBy('id', 'desc').limit(limit).offset(offset);
    const [{ count }] = await db('revisions').count('* as count');

    res.json({ success: true, data: revisions, meta: { page, limit, total: parseInt(count) } });
  } catch (err) {
    console.error('[api] GET /cycle/revisions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Step 2: Add GET /app-state endpoint**

```javascript
router.get('/app-state', requireSecret, async (req, res) => {
  try {
    const rows = await db('app_state').select('*').orderBy('key');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[api] GET /cycle/app-state error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Step 3: Add GET /token-usage endpoint**

```javascript
router.get('/token-usage', requireSecret, async (req, res) => {
  try {
    const usage = await db('cycle_logs')
      .select(db.raw("DATE(created_at) as date"))
      .sum('tokens_used as tokens')
      .count('* as cycles')
      .groupByRaw('DATE(created_at)')
      .orderBy('date', 'desc')
      .limit(30);

    const totalRow = await db('cycle_logs').sum('tokens_used as total').first();

    res.json({
      success: true,
      data: { daily: usage, total_tokens: parseInt(totalRow?.total || '0') }
    });
  } catch (err) {
    console.error('[api] GET /cycle/token-usage error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Step 4: Add DELETE /logs endpoint**

```javascript
router.delete('/logs', requireSecret, async (req, res) => {
  try {
    const days = Math.max(1, parseInt(req.query.older_than_days) || 90);
    const deleted = await db('cycle_logs')
      .where('created_at', '<', db.raw(`NOW() - INTERVAL '${days} days'`))
      .del();

    res.json({ success: true, deleted });
  } catch (err) {
    console.error('[api] DELETE /cycle/logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Step 5: Add search parameter to existing GET /logs**

Modify the existing `/logs` route to support `?search=` and `?errors_only=true`:

```javascript
router.get('/logs', requireSecret, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const errorsOnly = req.query.errors_only === 'true';

    let query = db('cycle_logs');
    let countQuery = db('cycle_logs');

    if (search) {
      const filter = builder => {
        builder.where('prompt_sent', 'ilike', `%${search}%`)
               .orWhere('response_raw', 'ilike', `%${search}%`);
      };
      query = query.where(filter);
      countQuery = countQuery.where(filter);
    }

    if (errorsOnly) {
      query = query.whereNotNull('error').where('error', '!=', '');
      countQuery = countQuery.whereNotNull('error').where('error', '!=', '');
    }

    const logs = await query.orderBy('id', 'desc').limit(limit).offset(offset);
    const [{ count }] = await countQuery.count('* as count');

    res.json({ success: true, data: logs, meta: { page, limit, total: parseInt(count) } });
  } catch (err) {
    console.error('[api] GET /cycle/logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Step 6: Commit**

```bash
git add src/web/routes/admin.js
git commit -m "feat(admin): add revisions, app-state, token-usage, delete-logs API endpoints"
```

---

### Task 2: Rewrite Auth Gate (admin-page.js)

**Files:**
- Modify: `src/web/routes/admin-page.js`

**Step 1: Rewrite admin-page.js to serve static file**

Replace the entire file with a simple auth gate that serves the static admin HTML and passes the secret via cookie:

```javascript
const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const secret = process.env.API_SECRET;
  if (!secret) return res.status(500).send('API_SECRET not configured');

  const provided = req.query.secret || req.cookies?.secret;
  if (provided !== secret) {
    return res.send(loginPage());
  }

  // Set cookie so JS can use it for API calls
  res.cookie('secret', provided, { httpOnly: false, sameSite: 'strict' });
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'admin.html'));
});

function loginPage() {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><title>Admin - PixelCoder</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 32px; width: 360px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.login h1 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; }
.login form { display: flex; gap: 8px; }
.login input { flex: 1; padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px; outline: none; }
.login input:focus { border-color: #666; }
.login button { padding: 8px 16px; background: #333; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.login button:hover { background: #555; }
</style>
</head><body>
<div class="login">
  <h1>PixelCoder Admin</h1>
  <form method="GET">
    <input type="password" name="secret" placeholder="API Secret" autofocus>
    <button type="submit">Login</button>
  </form>
</div>
</body></html>`;
}

module.exports = router;
```

**Step 2: Commit**

```bash
git add src/web/routes/admin-page.js
git commit -m "refactor(admin): rewrite auth gate to serve static admin files"
```

---

### Task 3: Admin CSS

**Files:**
- Create: `src/web/public/admin/admin.css`

**Step 1: Create admin.css**

Write the complete stylesheet for the admin portal. Key design tokens:

- Body: `#f5f5f5`, panels: `#fff` with `border: 1px solid #e0e0e0`, `border-radius: 6px`, `box-shadow: 0 1px 3px rgba(0,0,0,.08)`
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Monospace (for data): `"SF Mono", "Consolas", "Monaco", monospace`
- Tab bar: horizontal, top of page, active tab has bottom border accent `#333`
- Tables: full-width, striped rows (`#fafafa`), compact padding
- Status dots: `.status-ok { color: #22c55e }`, `.status-warn { color: #f59e0b }`, `.status-error { color: #ef4444 }`
- Buttons: dark (`#333` bg, white text), danger variant (red bg)
- Stat cards: white bg, subtle border, large number + small label
- Progress bar for token budget
- Expandable log detail: light grey bg, monospace, max-height with scroll
- Responsive: tab bar wraps on narrow screens

Full CSS to be written — approximately 250-300 lines covering all 6 tabs.

**Step 2: Commit**

```bash
git add src/web/public/admin/admin.css
git commit -m "feat(admin): add admin portal stylesheet"
```

---

### Task 4: Admin HTML

**Files:**
- Create: `src/web/public/admin/admin.html`

**Step 1: Create admin.html**

Structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin - PixelCoder</title>
  <link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
  <header class="admin-header">
    <h1>PixelCoder Admin</h1>
    <span class="worker-status" id="workerStatus"></span>
  </header>

  <nav class="tab-bar">
    <button class="tab active" data-tab="dashboard">Dashboard</button>
    <button class="tab" data-tab="logs">Logs</button>
    <button class="tab" data-tab="revisions">Revisions</button>
    <button class="tab" data-tab="tokens">Token Usage</button>
    <button class="tab" data-tab="appstate">App State</button>
    <button class="tab" data-tab="settings">Settings & Actions</button>
  </nav>

  <main>
    <section id="tab-dashboard" class="tab-content active">
      <!-- Stats cards, latest revision, budget bar, trigger button -->
    </section>

    <section id="tab-logs" class="tab-content">
      <!-- Search bar, error filter toggle, logs table, pagination -->
    </section>

    <section id="tab-revisions" class="tab-content">
      <!-- Revisions table, iframe preview area, pagination -->
    </section>

    <section id="tab-tokens" class="tab-content">
      <!-- Daily usage table, total, budget progress bar -->
    </section>

    <section id="tab-appstate" class="tab-content">
      <!-- Key/value table with inline edit -->
    </section>

    <section id="tab-settings" class="tab-content">
      <!-- Settings form, action buttons -->
    </section>
  </main>

  <script src="/admin/admin.js"></script>
</body>
</html>
```

Each section contains the container elements that `admin.js` will populate with data.

**Step 2: Commit**

```bash
git add src/web/public/admin/admin.html
git commit -m "feat(admin): add admin portal HTML shell"
```

---

### Task 5: Admin JavaScript

**Files:**
- Create: `src/web/public/admin/admin.js`

**Step 1: Create admin.js**

Structure the JS into clear sections:

```javascript
// --- Config ---
const SECRET = document.cookie.match(/secret=([^;]+)/)?.[1] || '';
const API_HEADERS = { 'x-api-secret': SECRET, 'Content-Type': 'application/json' };
const REFRESH_INTERVAL = 15000;

// --- Tab switching ---
// Click handlers on .tab buttons, toggle .active on buttons and tab-content sections
// Store active tab in URL hash so refresh preserves tab

// --- API helpers ---
// async function api(method, path, body?) -> json
// Centralized fetch with error handling

// --- Dashboard tab ---
// loadDashboard() — fetches /api/cycle/status, /api/cycle/token-usage
// Renders stat cards, worker status, latest revision, budget bar
// Auto-refresh timer (only when dashboard tab is active)

// --- Logs tab ---
// loadLogs(page, search, errorsOnly) — fetches /api/cycle/logs
// Renders table with expandable rows (full prompt/response, no truncation)
// Search input with debounce, error-only checkbox
// Pagination controls

// --- Revisions tab ---
// loadRevisions(page) — fetches /api/cycle/revisions
// Renders table, click handler opens iframe preview below table
// Pagination controls

// --- Token Usage tab ---
// loadTokenUsage() — fetches /api/cycle/token-usage
// Renders daily table + total + budget progress bar

// --- App State tab ---
// loadAppState() — fetches /api/cycle/app-state
// Renders key/value table
// Editable settings (EDITABLE_SETTINGS list) get inline input + save button
// Read-only rows rendered as plain text

// --- Settings & Actions tab ---
// Renders settings form (cycle_interval_hours, daily_token_budget, etc.)
// saveSettings() — PUT /api/cycle/settings
// triggerCycle() — POST /api/cycle/trigger
// clearLogs(days) — DELETE /api/cycle/logs?older_than_days=X (with confirm dialog)

// --- Init ---
// Parse URL hash for active tab
// Load initial tab data
// Start auto-refresh for dashboard
```

Full implementation — approximately 400-500 lines of vanilla JS.

**Step 2: Commit**

```bash
git add src/web/public/admin/admin.js
git commit -m "feat(admin): add admin portal client-side JavaScript"
```

---

### Task 6: Integration and Cleanup

**Files:**
- Modify: `src/web/server.js` (if needed — verify static serving covers `/admin/` path)

**Step 1: Verify static file serving**

The existing `express.static` middleware at line 9 serves from `public/`. Files at `public/admin/admin.css` and `public/admin/admin.js` will be served at `/admin/admin.css` and `/admin/admin.js`.

However, `/admin` route is handled by `admin-page.js` (line 16) which takes priority. The auth gate serves `admin.html` after auth — this is correct. The CSS/JS files are loaded by the HTML and fetched as static assets via `/admin/admin.css` etc.

**Potential issue:** The `/admin` route mount may intercept `/admin/admin.css`. Check if Express static middleware runs before the admin route. In `server.js` line 9 runs before line 16, so static files at `/admin/admin.css` should be served by static middleware first. Verify this works.

If static middleware doesn't catch it (because route mount on `/admin` intercepts), add explicit static serving:

```javascript
// In server.js, before the admin-page route:
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
```

**Step 2: Test the full flow**

1. Visit `/admin` without secret -> login page
2. Enter secret -> redirected to admin portal
3. All 6 tabs load data correctly
4. Auto-refresh works on dashboard
5. Log expansion shows full content
6. Revision preview iframe works
7. Settings save works
8. Trigger cycle works
9. Clear logs works (with confirmation)

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): complete admin developer portal integration"
```
