# Forester's lodge and tree regrowth

Status: ready-for-agent
Type: task
Blocked by: m2-camp-winter/02, m1-roads-logistics/06

## What

- Building `foresters_lodge` with a forester who plants saplings on empty forest-suitable tiles in a radius.
- A sapling grows into a mature tree in about one in-game year (content number); it can't be felled before then.
- Saplings don't block walking; mature trees do.
- Client: sapling placeholder art that grows through stages.

## Done when

- Headless tests: planting in radius, maturing on schedule, felling only when mature, determinism.
- `pnpm check` passes.
