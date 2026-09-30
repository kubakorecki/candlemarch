# Villagers standing on one tile can be told apart

Status: ready-for-agent
Type: task
Blocked by:

## What

Villagers pile up on the same spot and you can't tell how many there are (owner). Passing through one another is fine. The note breaks off at "But when they occupy a square, they should …".

Decided (owner, 2026-09-30): drawing only. Walkers standing still on the same tile are drawn fanned out within it (a small fixed formation by ID order), so every one shows; the sim is unchanged.

## Done when

- Screenshot of the Camp at Dusk with several villagers on one tile, each visible. `pnpm check` passes.

## Comments

2026-09-30 — Owner chose fanning out on the tile, drawing only.
