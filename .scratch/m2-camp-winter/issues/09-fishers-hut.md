# Fisher's hut and a frozen river

Status: resolved
Type: task
Blocked by: 02, 05, m1-roads-logistics/06

## What

- Content: resource `fish` (food). Building `fishers_hut`, placeable only with its door on a riverbank tile.
- The fisher works at the riverbank and yields fish.
- The river is frozen in winter (derived from the season): fishing stops. Draw frozen river differently.

## Done when

- Headless tests: placement rule, fishing yields, no fish in winter.
- `pnpm check` passes.

## Comments

2026-09-27 — Done: `fish` (granary), Fisher job, 1×1 `fishers_hut` with `doorOnRiverbank` (enforced in `fitsAt`, for maps too) and `fishes: { catchTicks: 400, yieldPerCatch: 1 }`. The Fisher fishes at the door; seasons carry `riverFrozen` (winter), and `isRiverFrozen` stops new catches and loses one under way. Client: tool on `f`, fish piece, ice-and-cracks river in winter. Differs: buildings don't rotate, so an east–west river is fishable only from its north bank (logged). No shipped map has a river yet, so the hut can't be tried in the client until ticket 20's Camp map.
