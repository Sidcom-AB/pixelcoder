# PixelCoder — Architecture

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                   docker-compose                      │
│                                                       │
│  ┌───────────┐   ┌───────────┐   ┌───────────────┐  │
│  │  web       │   │  worker    │   │  PostgreSQL    │  │
│  │  Express   │◄──│  Cron +    │──►│               │  │
│  │  + SSE     │   │  Claude    │   │  LISTEN/      │  │
│  │  + Static  │   │  API       │   │  NOTIFY       │  │
│  └─────┬─────┘   └───────────┘   └───────┬───────┘  │
│        │                                   │          │
│        │◄──── pg LISTEN 'new_revision' ───┘          │
│        │                                              │
└────────┼──────────────────────────────────────────────┘
         │ SSE: /api/events
         ▼
    ┌──────────┐
    │  Browser  │
    │  Frame +  │
    │  iframe   │
    └──────────┘
```

## Containers

### web (Express)

Serves everything visitors interact with:

- Static files: frame HTML/CSS/JS, avatar MP4s
- REST API: revisions, journal (paginated), calendar data
- SSE endpoint: real-time updates when new revision lands
- Admin endpoints: manual cycle trigger, cycle logs (protected by API_SECRET)

Listens on PostgreSQL `new_revision` channel to push SSE events.

### worker (Cron + Claude API)

Runs autonomously, no incoming HTTP:

- node-cron triggers a cycle every CYCLE_INTERVAL_HOURS
- Each cycle: reads recent revisions from DB, builds prompt from soul/ files, calls Claude API
- Stores result in revisions table, logs in cycle_logs table
- Fires `NOTIFY new_revision` after successful insert
- For `large` actions: makes multiple sequential Claude calls (multi-step)

### db (PostgreSQL)

Standard PostgreSQL. Used for:

- Revision storage (HTML/CSS/JS + journal entries)
- Technical cycle logs
- App state (current day counter, etc.)
- LISTEN/NOTIFY for inter-container signaling

## Database Schema

### revisions

The product. Every cycle produces one row.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| day_number | INTEGER | Days since START_DATE |
| cycle_number | INTEGER | Which cycle within the day |
| mood | VARCHAR(50) | Free-form, decided by Claude |
| action_size | VARCHAR(10) | 'none', 'small', 'medium', 'large' |
| html | TEXT | null = no change, inherit previous |
| css | TEXT | null = no change, inherit previous |
| js | TEXT | null = no change, inherit previous |
| journal_entry | TEXT | Character-voice, one line |
| created_at | TIMESTAMPTZ | |

### cycle_logs

Internal debugging. Full prompt/response pairs.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| revision_id | INTEGER FK | Links to revision |
| step_number | INTEGER | 1, 2, 3... for multi-step |
| prompt_sent | TEXT | What we sent to Claude |
| response_raw | TEXT | Full Claude response |
| tokens_used | INTEGER | |
| duration_ms | INTEGER | |
| error | TEXT | null = success |
| created_at | TIMESTAMPTZ | |

Auto-cleaned after CYCLE_LOGS_RETAIN_DAYS (default 90).

### app_state

Simple key-value for runtime state.

Initial rows: `current_day`, `total_cycles`.

## API Design

### Public

```
GET  /api/revisions/latest       Current state
GET  /api/revisions/:id          Specific revision
GET  /api/revisions/calendar     { day, count, moods[] } for calendar widget
GET  /api/revisions/day/:day     All revisions for a day

GET  /api/journal                Paginated (?page=1&limit=20)
GET  /api/journal/day/:day       Entries for a specific day

GET  /api/events                 SSE stream (new_revision events)
```

### Admin (API_SECRET required)

```
POST /api/cycle/trigger          Force a cycle now
GET  /api/cycle/logs             Technical logs (paginated)
GET  /api/cycle/status           Last cycle info, next scheduled time
```

## Frontend Architecture

### The Frame (our code, stable)

The outer CRT monitor shell from the original mock. Contains:

- CRT bezel, screws, power LED
- Avatar video player (mood-reactive MP4s)
- Journal panel with on-demand pagination
- Pixel calendar (7x5 grid, mood-colored dots per day)
- Code snippet display
- SSE listener for live updates

### The Inner World (Claude's code, in iframe)

Rendered via `<iframe srcdoc="...">`. Completely isolated:

- Claude can write any HTML/CSS/JS
- Can import CDN libraries (three.js, p5.js, whatever)
- Cannot affect the frame
- Sandboxed but creative

### Realtime Flow

1. Worker completes cycle → INSERT revision → `NOTIFY new_revision`
2. Web receives pg notification → pushes SSE event with revision data
3. Browser EventSource receives event → updates iframe + journal + avatar

## Soul System

```
src/soul/
  persona.md          Character identity, personality traits, quirks
  system-prompt.md    The actual system prompt sent to Claude each cycle
  cycle-rules.md      Action sizes, multi-step rules, constraints
  examples.md         Few-shot examples of good outputs
```

Worker loads these at each cycle start. Edit markdown to change personality — no code deploy needed.

## Configuration

All behavior controlled via .env:

| Variable | Purpose | Default |
|----------|---------|---------|
| ANTHROPIC_API_KEY | Claude API access | required |
| CLAUDE_MODEL | Which model | claude-sonnet-4-20250514 |
| CYCLE_INTERVAL_HOURS | Time between cycles | 3 |
| START_DATE | Day 1 of timeline | required |
| API_SECRET | Admin endpoint auth | required |
| CYCLE_LOGS_RETAIN_DAYS | Log cleanup | 90 |
| DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD | PostgreSQL | see .env.example |
| PORT | Web server port | 3000 |

## Storage Estimates

- ~15 KB per full revision (HTML + CSS + JS)
- ~120 KB/day (8 cycles)
- ~44 MB/year for revisions
- cycle_logs heavier but auto-cleaned
- PostgreSQL handles this trivially
