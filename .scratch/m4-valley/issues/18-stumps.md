# Stumps that regrow

Status: resolved
Type: task
Blocked by: 09

## What

Rules in `docs/spec.md`, World and map ("Forest ecology"). Numbers Proposed, all in content.

- A felled tree leaves a **Stump**: a map object that doesn't block walking and gives no shade.
- After 1 in-game year, a Stump sprouts a Sapling (ticket 09's), which matures as usual. A clear-cut heals in about two years.
- Placing a building, Road, Drain or Stockpile on the tile removes the Stump. The forester may not plant on a Stump's tile.
- Client: stump placeholder art.

## Done when

- Headless tests: felling leaves a Stump; it sprouts a Sapling on schedule, which matures into a fellable tree; building or laying a Road on it removes it; a Hunting ground's ceiling rises again once the regrown tree matures; determinism and save/load.
- `pnpm check` passes.

## Comments

2026-09-30 — Done: a felled tree becomes a `stump` in place (same ID) that sprouts a Sapling after 20 days (then 20 more to a tree); walked over, no shade, cleared by a building, wall, Drain/Pass road, Stockpile or Dirt path on its tile; the forester doesn't plant on it; client stump art. Also cleared by walls and Stockpiles, not only buildings and Roads, same as Saplings (ticket 09). The Camp's first year is unchanged. See `docs/decisions.md`.
