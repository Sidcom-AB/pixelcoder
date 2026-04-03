# Responsive Layout Design

## Goal
Make PixelCoder work well on desktop, tablet, and mobile using CSS breakpoints + minimal JS.

## Breakpoints
- **Desktop (>1024px):** Current layout unchanged
- **Tablet (768-1024px):** Compressed work-side (~300px), compact calendar, no code-box
- **Mobile (<768px):** Top-bar + bottom tab-bar, fullscreen tabs

## Mobile Layout

**Top-bar:** Replaces CRT frame shell. 40px, shows LED + "PIXELCODER" title.

**Tabs (bottom bar, 48px fixed):**
| Tab | Content |
|-----|---------|
| Screen | CRT iframe, full remaining height |
| Journal | Compact date-nav `< DAG 3 >` + scrollable journal entries |
| Info | Character video (120x120) + calendar grid + code-box |

**Character video** lives on Info tab, not floating.

## Tablet Layout
- Work-side shrinks to ~300px
- Calendar switches to inline `< APR 3, 2026 >` date navigator
- Code-box hidden
- Character video shrinks to 120x120

## Admin area
No changes needed.

## Implementation approach
Pure CSS media queries + ~30 lines JS for tab switching. Minimal HTML additions (tab-bar element, data-tab attributes).
