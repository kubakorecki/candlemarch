# Road-aware A*

Status: ready-for-agent
Type: task
Blocked by: 03

## What

Job-dispatch carriers prefer roads when they're faster.

- A* step cost = step length (1000 or 1414) × 100 / speed percent of the tile being entered, integer division.
- The heuristic must stay admissible: scale it by the fastest road's speed percent from content.
- Tie-breaking stays as it is (f, then h, then tile index).
- Off-road movement stays 8-directional, with no corner cutting.

## Done when

- Test: on a small map with a path that's longer in tiles but faster, the carrier takes the path; without the path it goes straight.
- Existing pathfinding tests still pass.
- `pnpm check` passes.
