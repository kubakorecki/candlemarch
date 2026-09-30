# Forester's lodge and tree regrowth

Status: resolved
Type: task
Blocked by: m2-camp-winter/02, m1-roads-logistics/06

## What

- Building `foresters_lodge` with a forester who plants Saplings on empty Meadow tiles in a radius (no building, Road, Stockpile, map object or site on the tile).
- A sapling grows into a mature tree in about one in-game year (content number); it can't be felled before then.
- Saplings don't block walking; mature trees do.
- A Sapling counts as a standing tree (shade for Forage patches, a Hunting ground's ceiling, Forest) only once it matures.
- Client: sapling placeholder art that grows through stages.

## Done when

- Headless tests: planting in radius, maturing on schedule, felling only when mature, a Sapling giving no shade until it matures, determinism.
- `pnpm check` passes.

## Comments

2026-09-29 — Design session 03: a Sapling counts as a standing tree only once mature, and the forester plants only on empty Meadow. Stumps that regrow by themselves are ticket 18.

2026-09-30 — Done: `foresters_lodge` with a `forester` (sim `forest.ts`, `systems/forestry.ts`, `systems/growth.ts`), `sapling` growing into a tree in 20 days (3 drawing stages), walked over, unfellable, no shade or Game until grown; client tool (key I, Gathering), sapling art, forester's spade. Beyond the issue: the forester plants only on even x and y tiles (spacing 2, so grown plantings leave walkways) and never on doors, the entry, Dens or caches; a building, wall, groundwork, Stockpile or Dirt path placed on a Sapling clears it; Den budding skips Sapling tiles. See `docs/decisions.md`.
