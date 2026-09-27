# Autosave at dawn

Status: resolved
Type: task
Blocked by: 02

## What

- The client autosaves at the start of each in-game day to a separate `localStorage` slot (`candlemarch.autosave`), next to the manual slot.
- Load menu offers both slots with their day and season.
- Autosave never blocks the game loop noticeably.

## Done when

- Client test for the dawn detection; manual check in the browser.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done: the worker autosaves the state at each Dawn but the game's first (`isAutosaveTick` in `client/src/game/autosave.ts`, tested in `client/test/autosave.test.ts`) to `candlemarch.autosave`; the Load button opens a menu with both slots and their day, season and year. Serialization happens in the worker, so the frame loop only pays one `localStorage.setItem` a day. The client builds; the manual browser check is left for the owner (no browser available to this session).
