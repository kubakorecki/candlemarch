# River terrain

Status: resolved
Type: task
Blocked by: none

## What

- Content terrain `river`: not walkable, not buildable. Map legend character `~`.
- Helper "is riverbank": a walkable tile orthogonally next to a river tile (the fisher's hut and, later, the clay pit and watermill need it).
- Client: draw river tiles (flat water with a dark outline, palette colours).
- Winter freezing is ticket 09; this ticket is terrain only.

## Done when

- Map tests: river tiles block paths and placement; riverbank helper.
- `pnpm check` passes.

## Comments

2026-09-27 — Done in `5595f91` (content, sim, client: add river terrain).
