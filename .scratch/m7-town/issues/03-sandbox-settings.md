# Sandbox settings and main menu

Status: needs-info
Type: task
Blocked by: 01, m4-valley/12

## What

- A player-facing main menu: New game (seed, hero, winter harshness, monster rate), Load, Continue (autosave).
- Settings are stored in state and read by the systems they affect.
- The dev New-game panel stays behind a dev flag.

## Open questions (design session 01, Q3)

- Setting levels and effects.

## Done when

- Headless tests: each setting changes its system's numbers; the menu works in the browser.
- `pnpm check` passes.

## Comments

2026-09-28 — M3 design session: the Monster rate already exists in state from `m3-nights/03` (0–100, 0 is off, set at New game and by a dev command). This ticket turns it into player-facing levels rather than adding it.
