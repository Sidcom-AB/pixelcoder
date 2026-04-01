# PixelCoder

A living website with an autonomous pixel-art developer character who evolves his own CRT-displayed website every 3 hours, powered by Claude API.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL + Knex
- **Frontend:** Vanilla JavaScript (ES Modules)
- **AI:** Claude API (Anthropic SDK)
- **Infra:** Docker Compose (web + worker + db)
- **Realtime:** PostgreSQL LISTEN/NOTIFY + Server-Sent Events

## Architecture

Two containers share one PostgreSQL database:

- `web` — Express server: serves the frame, API endpoints, SSE stream, static assets
- `worker` — Cron process: runs autonomous Claude cycles, writes revisions to DB

See `ARCHITECTURE.md` for full details.

## Project Structure

```
src/web/          Web container (Express + static frontend)
src/worker/       Worker container (cron + Claude API)
src/shared/       Shared code (db connection)
src/soul/         Character personality files (persona, prompts, rules)
migrations/       Knex migrations
docs/plans/       Design documents
```

## Commands

```bash
docker-compose up           # Start everything
docker-compose up -d        # Detached
docker-compose logs -f web  # Follow web logs
docker-compose logs -f worker

# Development (outside Docker)
npm install
npm run dev:web             # Web server with nodemon
npm run dev:worker          # Worker with nodemon
npm run migrate             # Run migrations
npm run migrate:rollback    # Rollback
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `ANTHROPIC_API_KEY` — Required. Claude API key.
- `CLAUDE_MODEL` — Model to use (default: claude-opus-4-6)
- `API_SECRET` — Protects admin endpoints (cycle trigger, logs, settings)
- `DB_*` — PostgreSQL connection

## Database Settings

These live in the `app_state` table and are editable via the admin panel (`/admin`):

- `cycle_interval_hours` — Hours between cycles (default: 3)
- `start_date` — Day 1 of the character's timeline (default: 2026-04-01)
- `cycle_logs_retain_days` — Auto-cleanup for technical logs (default: 90)
- `daily_token_budget` — Soft daily token limit (default: 120000). Character adjusts behavior based on remaining budget.

Seeded by migration with defaults. Worker re-reads settings dynamically (no restart needed for interval changes).

## Key Concepts

### The Frame vs The Inner World

- **Frame** = the CRT monitor shell, avatar, journal, calendar. OUR code. Stable.
- **Inner World** = the CRT screen content. CLAUDE'S code. Rendered in an iframe via `/render/:id`. Changes every cycle.

### Two Logs

- **Journal** (public) — one-line character-voice entries visible to visitors
- **Cycle logs** (internal) — full prompts, responses, tokens for debugging

### Soul Files

`src/soul/*.md` define the character's personality and behavior. Edit these to change how the character acts — no code changes needed.

## Rules

1. **Never hardcode mood logic** — Claude decides mood/action freely based on persona + history
2. **Frame is stable** — changes to the frame layout/design are intentional and rare
3. **Inner World is isolated** — rendered in iframe, can use any CDN lib, cannot affect frame
4. **Full revision storage** — no deltas, store complete HTML/CSS/JS per revision
5. **Config via DB** — cycle timing, budget, retention editable in admin panel; secrets stay in .env
6. **Soul files are markdown** — personality tweaks don't require code deploys
