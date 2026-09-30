# Trees slow walkers instead of blocking them

Status: ready-for-agent
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
