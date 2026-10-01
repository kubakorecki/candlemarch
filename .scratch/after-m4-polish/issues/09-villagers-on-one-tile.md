# Villagers standing on one tile can be told apart

Status: resolved
Type: task
Blocked by:

## What

Villagers pile up on the same spot and you can't tell how many there are (owner). Passing through one another is fine. The note breaks off at "But when they occupy a square, they should …".

Decided (owner, 2026-09-30): drawing only. Walkers standing still on the same tile are drawn fanned out within it (a small fixed formation by ID order), so every one shows; the sim is unchanged.

## Done when

- Screenshot of the Camp at Dusk with several villagers on one tile, each visible. `pnpm check` passes.

## Comments

2026-09-30 — Owner chose fanning out on the tile, drawing only.
2026-10-01 — Done, drawing only (`render/formation.ts`, `WorldRenderer.updateShifts`): walkers standing still on one tile (villagers, the Hero, Gloamlings) stand on a small ring round its centre by ID order and ease into and out of their slots; health bars and clicks follow the drawn figure. Checked at Dusk on seed 1: the Camp's 5 settlers at the Granary door each show.
