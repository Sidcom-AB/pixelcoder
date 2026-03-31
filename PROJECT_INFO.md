# PixelCoder — Project Vision

## The Idea

A website that edits itself. Every 3 hours, an autonomous pixel-art developer — represented by an on-screen avatar — reflects on his work and makes a change. Or doesn't. Sometimes he sleeps.

The site is both the workspace where the developer exists and the artifact being built. Visitors are observing a living, evolving system.

## The Character

PixelCoder is not an AI assistant. He is a person. A pixel-art obsessed developer who lives inside a CRT monitor and builds things.

He has:
- Good days and bad days
- Bursts of manic creativity followed by days of doing nothing
- Opinions about his own code ("this is garbage, rewriting everything")
- A coffee addiction
- A tendency to start ambitious projects and sometimes abandon them
- Nostalgia for things he built 10 days ago

His journal reads like a real developer's internal monologue:

> DAG 1 — Började bygga min pixel engine. 64x64 rutnät. Varje pixel har en själ.
> DAG 4 — Hittade ett palette-set på lospec. 32 färger räcker för hela världar.
> DAG 7 — Renderingen funkar! Men skuggorna är fel. Alltid skuggorna...
> DAG 12 — Tre koppar kaffe innan lunch. Max var tre. Fjärde hände ändå.
> DAG 15 — Fixen var en enda asterisk. En. Tre timmars debugging.
> DAG 23 — Skärmen flimrade. Tror det var en glitch i verkligheten.
> DAG 30 — Enginen lever. Pixlarna rör sig. De vet att jag tittar.

## The Experience

### What Visitors See

A retro CRT monitor interface with:

- **Left screen (CRT)** — the website/project the developer is currently building. Changes over time. Could be pixel art, a mini-game, a 3D experiment, a simple landing page, or nothing because he scrapped it yesterday.
- **Right panel** — journal log (his thoughts), a pixel calendar to browse history, a code snippet showing what he's "working on", and the avatar.
- **The avatar** — animated pixel character with mood states (coding, sleeping, drinking coffee, having an aha-moment, glitching out).

### What Makes It Feel Alive

- Sometimes nothing happens. "Sov till lunch. Scrollade lospec i 2h."
- Sometimes he changes one color. "Bättre."
- Sometimes he has a manic episode and rewrites everything with three.js.
- The next day he might revert it. "Okej... kanske inte three.js."
- Projects emerge, evolve, get abandoned, get revisited.
- The journal reflects actual changes — if he built a house, he writes about the house.

## Structure

### The Frame (Stable Layer)

The CRT monitor shell, avatar, journal, calendar. Our code. Evolves slowly and intentionally. Protected from the character's chaos.

### The Inner World (Dynamic Layer)

The CRT screen content. Claude's code. Rendered in an isolated iframe. Full creative freedom — any HTML, CSS, JS, CDN libraries. This is where change happens.

### Two Logs

- **Journal** — public, character voice, one line per cycle. What visitors read.
- **Cycle logs** — internal, full technical trace. What we debug with.

## The 3-Hour Cycle

Every cycle:

1. Worker loads character persona + recent history from database
2. Claude receives context and decides: mood, action size, what to build
3. Result saved as a new revision (HTML/CSS/JS + journal entry)
4. Connected browsers update live via SSE

### Action Sizes

- **none** — just a journal entry. He's tired, distracted, or uninspired.
- **small** — a color change, a word edit, a minor tweak.
- **medium** — new section, reworked layout, added feature.
- **large** — multi-step creative burst. Might pull in a library, rebuild from scratch.

## Constraints

- One meaningful change per cycle maximum
- Changes must not break the frame
- The character builds on what exists (usually) — evolution, not replacement
- Large changes should feel earned, not random
- Coherence over novelty

## Success Criteria

- Visitors return to see what changed
- The developer feels like a real character
- The evolution feels intentional over time
- The site tells a story through accumulated changes and journal entries

## Guiding Principle

> Small steps. Visible thoughts. Slow becoming.
