# Workplace yards: a tile beside the building for its goods

Status: ready-for-agent
Type: task
Blocked by: 01, 02

## What

Workers put what they make "on the ground near the hut" (the output buffer drawn as a loose pile). Give Workplaces a designated 1×1 yard, part of the building, that looks like a small Stockpile tile and holds at most 10 items (owner).

Decided (owner, 2026-09-30):
- Every Workplace with an output buffer gets one yard tile, in its content layout next to the door, turning with the building. It's part of the footprint for placement (nothing else built there) and blocks walking like the building; Carriers pick up from the door as now.
- The yard holds 10 in total, shared by all the building's outputs (a hunter's meat and hides together); a catch, basket or batch must fit whole.
- The Granary and Houses get none. The fisher's hut's yard must stand on land.
- Drawn like a Stockpile tile with the goods piled on it; the old loose pile goes.

## Done when

- Headless tests: the yard's tile is refused to other placements; a gatherer stops when the shared 10 is full; Carriers empty it.
- Balance scenarios rerun and noted. `pnpm check` passes. Checked in the browser on all four turns.

## Comments

2026-09-30 — Owner confirmed the proposed defaults as written.
