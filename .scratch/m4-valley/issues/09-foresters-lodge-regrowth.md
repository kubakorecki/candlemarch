# Forester's lodge and tree regrowth

Status: ready-for-agent
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
