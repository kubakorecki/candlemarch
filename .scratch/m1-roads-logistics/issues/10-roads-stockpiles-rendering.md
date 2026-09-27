# Render and place roads, flags and stockpiles

Status: resolved
Type: task
Blocked by: 03, 05, 06, 07

## What

Client side of M1. Colours from `palette.ts`, iso math from `iso.ts`.

- Draw dirt paths (straight pieces, corners, junctions), Flags, and the goods waiting on a Flag.
- Draw stockpile tiles as bare dirt, with a visible stack per tile that grows with its amount.
- Icons: "no worker" over unstaffed Workplaces, "no carrier" over unstaffed Segments.
- HUD tools with hover previews using the sim's `canLayPath` / `canPlaceStockpile` / placement rules:
  - Path (drag L), Remove path (drag L), Flag (click), Stockpile (drag rectangle), Woodcutter's hut (click).
- Keyboard shortcuts for the tools, alongside the existing B / Space / 1–3. Esc and right-click cancel, as today.
- No game logic in the client.

## Done when

- Everything above can be placed, seen and removed in the browser under both models.
- `pnpm check` passes.

## Comments

2026-09-26 — Done in `f3cdc66` (sim, client: render roads and stockpiles, add stockpile priorities). The Flag tool went with flag relay in `df496a0`.
