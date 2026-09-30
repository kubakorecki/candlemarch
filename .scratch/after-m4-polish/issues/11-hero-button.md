# Select the Hero from the HUD

Status: ready-for-agent
Type: task
Blocked by:

## What

An avatar button for the Hero in the HUD (Vellum: `docs/agents/design-system.md`) selects the Hero and moves the camera to it; a hotkey does the same (owner: 1 by default).

Keys 1, 2 and 3 set game speed today (`Game.onKey`). Decided (owner, 2026-09-30): the Hero takes 1, and speed moves to F1/F2/F3 (1×/2×/3×); tooltips and hints say so. Stop the browser's own F-key actions where they clash.

## Done when

- Clicking the button or pressing the key selects the Hero and centres the camera; the button shows the Hero's HP.
- `pnpm check` passes; checked in the browser.

## Comments

2026-09-30 — Owner: Hero on 1, speed on F1/F2/F3.
