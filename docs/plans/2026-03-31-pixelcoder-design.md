# PixelCoder — System Design

## What Is This?

A living website featuring an autonomous pixel-art developer character who builds, experiments, rests, and evolves his own CRT-displayed website every 3 hours — powered by Claude API.

Visitors watch a character that feels alive: sometimes he codes all night, sometimes he changes one color and calls it a day, sometimes he scraps everything and starts over.

---

## Architecture: Approach B — Separated Web + Worker

```
docker-compose:
  web       Express (frame + API + SSE + static assets)
  worker    Cron + Claude API (autonomous cycles)
  db        PostgreSQL (revisions, journals, logs)
```

Why separated: Claude API calls can take 30-60s. If worker crashes or hangs, the site stays up. Clean separation of concerns.

### Signal System: PostgreSQL LISTEN/NOTIFY + SSE

- Worker inserts new revision → `NOTIFY new_revision`
- Web listens on pg channel → pushes SSE event to all connected browsers
- Browser receives event → updates iframe, journal, avatar mood live

No extra dependencies. Built into PostgreSQL and browsers natively.

---

## The Character System

Claude is NOT given hardcoded mood states or probabilities. Instead, he receives a persona prompt and his recent history, and decides for himself what to do.

### Action Sizes

| Action | What happens |
|--------|-------------|
| `none` | Just a journal entry. "Sov till lunch." |
| `small` | One color change, a word edit, minor tweak |
| `medium` | New section, reworked layout, added feature |
| `large` | Multi-step: total rework, new library via CDN, big creative leap |

For `large` actions, worker makes multiple sequential Claude API calls (a mini-conversation), storing intermediate steps in cycle_logs.

### Soul Files

```
src/soul/
  persona.md          Who PixelCoder is — personality, habits, quirks
  system-prompt.md    The actual prompt sent to Claude each cycle
  cycle-rules.md      Rules: action sizes, multi-step, constraints
  examples.md         Few-shot examples of good journal entries + outputs
```

Editable without code changes. Want to tweak his personality? Edit persona.md.

### Two Logs

1. **Journal** (public, in revisions table) — one line per cycle, character voice. Sarcastic, human, imperfect.
2. **Cycle logs** (internal, cycle_logs table) — full prompts, responses, tokens, timing. For debugging and observing the "real" process.

---

## Database Schema

```sql
CREATE TABLE revisions (
  id            SERIAL PRIMARY KEY,
  day_number    INTEGER NOT NULL,
  cycle_number  INTEGER NOT NULL,
  mood          VARCHAR(50),
  action_size   VARCHAR(10),          -- 'none','small','medium','large'
  html          TEXT,                  -- null = no change, inherit previous
  css           TEXT,
  js            TEXT,
  journal_entry TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cycle_logs (
  id            SERIAL PRIMARY KEY,
  revision_id   INTEGER REFERENCES revisions(id),
  step_number   INTEGER NOT NULL,
  prompt_sent   TEXT,
  response_raw  TEXT,
  tokens_used   INTEGER,
  duration_ms   INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_state (
  key           VARCHAR(100) PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage math

- ~15 KB per full revision, ~120 KB/day, ~44 MB/year. Trivial.
- Null fields for no-change cycles. No deltas needed.
- cycle_logs retained per CYCLE_LOGS_RETAIN_DAYS env var (default 90).

---

## API Endpoints

```
GET  /                            Frame (index.html)
GET  /assets/*                    MP4s, images, static

GET  /api/revisions/latest        Current revision
GET  /api/revisions/:id           Specific revision
GET  /api/revisions/calendar      Calendar data { day, count, moods[] }
GET  /api/revisions/day/:day      All revisions for a day

GET  /api/journal                 Paginated (?page=1&limit=20)
GET  /api/journal/day/:day        Entries for specific day

GET  /api/events                  SSE stream

POST /api/cycle/trigger           Manual trigger (API_SECRET protected)
GET  /api/cycle/logs              Technical logs (paginated)
GET  /api/cycle/status            Last cycle status, next scheduled
```

---

## Frontend

The frame is the current index.html mock, made dynamic:

- **CRT iframe** — `<iframe srcdoc="...">` loaded from revision HTML/CSS/JS. Full sandbox, Claude can import CDN libs, write any code.
- **Pixel calendar** — 7x5 grid near journal. Colored dots per day (mood-colored). Click day → load that day's revisions.
- **Journal** — on-demand pagination (infinite scroll upward). Filtered by calendar selection.
- **Avatar** — mood from revision triggers appropriate MP4 (Coding, Sleepy, Coffee, etc.)
- **SSE listener** — live updates when new revision lands.

### File Structure

```
pixelcoder/
├── docker-compose.yml
├── .env.example
├── knexfile.js
├── migrations/
│   └── 001_initial.js
├── CLAUDE.md
├── PROJECT_INFO.md
├── ARCHITECTURE.md
│
├── src/
│   ├── shared/
│   │   └── db.js
│   │
│   ├── web/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── revisions.js
│   │   │   ├── journal.js
│   │   │   ├── events.js
│   │   │   └── admin.js
│   │   └── public/
│   │       ├── index.html
│   │       ├── css/
│   │       │   └── frame.css
│   │       ├── js/
│   │       │   ├── app.js
│   │       │   ├── player.js
│   │       │   ├── journal.js
│   │       │   └── calendar.js
│   │       └── assets/
│   │           └── *.mp4
│   │
│   ├── worker/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── worker.js
│   │   ├── cycle.js
│   │   └── claude.js
│   │
│   └── soul/
│       ├── persona.md
│       ├── system-prompt.md
│       ├── cycle-rules.md
│       └── examples.md
│
└── docs/
    └── plans/
```

---

## Configuration (.env)

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME=pixelcoder
DB_USER=postgres
DB_PASSWORD=

# Cycle
CYCLE_INTERVAL_HOURS=3
START_DATE=2026-04-01
CYCLE_LOGS_RETAIN_DAYS=90

# Admin
API_SECRET=

# Server
PORT=3000
NODE_ENV=production
```

---

## Key Design Decisions

1. **Full HTML storage, no deltas** — simpler code, trivial storage cost
2. **iframe srcdoc for CRT** — total isolation, Claude can use any CDN lib
3. **Claude decides mood/action freely** — no hardcoded state machine
4. **Soul files as markdown** — personality changes without code deploys
5. **SSE over WebSocket** — one-way is all we need, zero dependencies
6. **PostgreSQL LISTEN/NOTIFY** — inter-container signaling without Redis
7. **Two separate logs** — public journal (character voice) vs internal cycle_logs (debugging)
