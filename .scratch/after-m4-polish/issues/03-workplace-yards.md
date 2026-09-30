# Workplace yards: a tile beside the building for its goods

Status: resolved
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

2026-09-30 — Done. Every Workplace with an output (woodcutter's, forager's and fisher's huts, hunter's lodge, chopping block) has its yard at (1, 0), beside the body along the door's wall, in `outputBuffer.yard`; `logistics.yardCapacity` 10 is shared by all its outputs, and catches, baskets and batches go in whole (`sim/src/yards.ts`). The yard is in the layout's `tiles` (placement, walking, selecting, demolishing), but the work radius and the Hero's aura still measure from the building itself. Gatherers now wait until a whole gather fits (was: any room). Drawn as a Stockpile tile's dirt with a pile per output; the panel says "Yard 6 / 10" plus a line per output when there are two. The camp balance script's hunter's lodge moved one tile west (its yard fell on the path). Scenarios rerun (docs/decisions.md): all keep their outcomes; `valley` now ends with 5 meat (was 0). Checked in the browser on all four turns, placement ghost included.
