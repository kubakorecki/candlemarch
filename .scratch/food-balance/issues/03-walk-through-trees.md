# Trees slow walkers instead of blocking them

Status: resolved
Type: task
Blocked by: 02

## What

Owner's decision (spec.md): everyone crosses trees at 50% speed; trees still block building.

- Content: `MapObjectDef.walkSpeedPercent`, 50 on `tree`. Deposits and Forage patches keep blocking.
- Sim: the walk grid no longer blocks on trees; walking speed on a tile is the slowest of its terrain/road and what stands on it (a cached grid, like the other map data).
- Everything that used the walk grid to mean "a tree is here" still refuses trees: buildings, Dirt paths, Stockpiles, walls, groundwork, Den budding, forester planting.
- Spec (Terrain, Forest ecology) and `docs/decisions.md`: forests no longer wall Gloamlings off.

## Done when

- Headless tests: a villager walks through a tree line at half speed; nothing can be built, paved or piled on a tree; no Den buds under one.
- `pnpm bench:maps valley` stays within ADR-0004's budget.
- `pnpm check` passes.

## Comments

2026-09-30 — Done. `MapObjectDef.walkSpeedPercent` (50 on `tree`); `objectSpeedGrid` and `occupiedGrid` in `grid.ts`; walk grids fold object speeds in; placement uses `occupiedGrid`. Tests in `trees.test.ts`; older tests that used a tree as a wall now use a berry bush or check `occupiedGrid`. The Valley test's "every walkable tile reachable" skips tree tiles (seed 11 has a tree hemmed in by river and patches). Bench unchanged. `valley` still starves (see 05). See `docs/decisions.md`.
