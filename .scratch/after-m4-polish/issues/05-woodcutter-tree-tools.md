# Tree tools in the woodcutter's hut: fell these, keep those, dig out stumps

Status: resolved
Type: task
Blocked by: 02

## What

The player should choose which trees get cut and which are left alone (e.g. to clear a building spot or a road), and dig out Stumps, from the woodcutter's hut (owner).

Decided (owner, 2026-09-30):
- The woodcutter's hut panel has three tools, each painted as a rectangle like the Reserve: **Fell** marks trees for felling, **Keep** is the existing Reserve (moved from the build menu into the panel; the overlay stays), **Dig stumps** marks Stumps.
- A woodcutter fells marked trees in its radius before any other tree; unmarked trees are still felled as now unless in a Reserve. Marking a tree in a Reserve is refused (or unmarks the Reserve there; pick one and log it).
- Digging out a marked Stump takes a woodcutter some ticks (Proposed 100), yields 1 log (brought to the hut like a felled log), and leaves bare Meadow (no Sapling later).
- Marks live in state (plain data), survive save/load, and draw on the map.

## Done when

- Headless tests: marked trees go first; Keep still protects; a marked Stump is dug out and never sprouts; save/load keeps marks.
- Client: the three tools in the hut panel. `pnpm check` passes.

## Comments

2026-09-30 — Owner confirmed the defaults, with one change: digging out a Stump gives 1 log.

2026-10-01 — Done. The woodcutter's hut panel has a "Trees" row: Fell, Keep (the Reserve, moved out of the build menu; M still picks it), Dig stumps and a fourth tool, Erase (the old Erase Reserve, key A, now also taking Fell and Dig marks off), since marks need a way off. A mark is a flag on the map object (`mapObject.marked`), so it travels in the existing static patch and leaves with the object (a felled marked tree's Stump starts unmarked). Marking a tree in a Reserve is refused (that tree is skipped), and painting Keep takes Fell marks off the trees it covers. Marked trees and marked Stumps come first together, nearest first. Digging takes 100 ticks (the Stump's gather numbers, via a new `BuildingDef.digs`) and gives 1 log. Marks are drawn as paint-coloured pennants. Tests: `sim/test/marks.test.ts`. Details in `docs/decisions.md`.
