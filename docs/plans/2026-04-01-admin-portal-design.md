# Admin Developer Portal — Design

**Date:** 2026-04-01
**Status:** Approved

## Goal

Replace the retro-styled admin page with a clean, readable developer backoffice portal optimized for debugging, log inspection, and system management.

## Visual Style

- Light neutral background (`#f5f5f5` body, white panels)
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`), monospace only for data/code
- Subtle grey borders, light box-shadow on panels
- Status colors: green = ok, yellow = warning, red = error
- Compact but airy — optimized for scanning data quickly

## Architecture: Approach B — Static Files + API

### File Structure

```
src/web/public/admin/
  admin.html       — shell + tab navigation
  admin.css        — all styling
  admin.js         — tab switching, API calls, rendering

src/web/routes/
  admin-page.js    — auth gate, serves admin.html (rewritten)
  admin.js         — API endpoints (extended with new endpoints)
```

### Auth Flow

Same as today: `?secret=X` in URL -> cookie set -> `admin-page.js` validates and serves `admin.html`. Client JS sends `x-api-secret` header on all API calls.

## Tabs (6)

### 1. Dashboard (default, auto-refresh every 15s)
- Worker status with heartbeat indicator (green/yellow/red dot + "last seen Xs ago")
- Stats cards: Current Day, Total Cycles, Revisions, Cycle Logs, Model
- Latest revision summary row
- Token budget: today's usage vs budget (progress bar)
- Quick action: Trigger Cycle button

### 2. Logs
- Table: ID, Revision, Step, Tokens, Duration, Time, Error indicator
- Search/filter: free-text search in prompt/response, filter on has-error
- Click row to expand full prompt + response (no truncation, with scrollbar)
- Pagination (20 per page with prev/next)

### 3. Revisions
- Table: ID, Day, Cycle, Mood, Action Size, Created
- Click row to open iframe preview of `/render/:id` below table
- Pagination

### 4. Token Usage
- Daily usage table (date, tokens, cycle count)
- Total consumed
- Budget status with progress bar
- Aggregated from `cycle_logs`

### 5. App State
- Raw table of all key/value pairs in `app_state`
- Shows `updated_at` per row
- Editable settings marked, others read-only
- Inline edit + save on editable fields

### 6. Settings & Actions
- Settings form (same fields as today, cleaner layout)
- Actions: Trigger Cycle, Clear Old Logs (with confirmation dialog)
- Worker info: heartbeat details, interval

## New API Endpoints

- `GET /api/cycle/revisions?page=1&limit=20` — paginated revisions list
- `GET /api/cycle/app-state` — all key/values from `app_state`
- `GET /api/cycle/token-usage` — daily aggregation from `cycle_logs`
- `DELETE /api/cycle/logs?older_than_days=X` — clear old logs

## Existing Endpoints (kept)

- `POST /api/cycle/trigger` — trigger cycle
- `GET /api/cycle/status` — app state summary
- `GET /api/cycle/logs?page=N&limit=N` — paginated logs
- `PUT /api/cycle/settings` — update settings
