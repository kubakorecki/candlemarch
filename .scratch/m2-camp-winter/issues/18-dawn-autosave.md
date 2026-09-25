# Autosave at dawn

Status: ready-for-agent
Type: task
Blocked by: 02

## What

- The client autosaves at the start of each in-game day to a separate `localStorage` slot (`candlemarch.autosave`), next to the manual slot.
- Load menu offers both slots with their day and season.
- Autosave never blocks the game loop noticeably.

## Done when

- Client test for the dawn detection; manual check in the browser.
- `pnpm check` passes.
