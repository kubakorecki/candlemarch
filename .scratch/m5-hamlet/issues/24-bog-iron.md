# Bog iron

Status: resolved
Type: task
Blocked by: 04, 06

## What

Spec: Resources (Renewing what runs out). Glossary: Bog iron.

- Every Swamp tile holds a little iron ore (content: a cap per tile), back up to the cap at the start of each spring. Swamp stays walkable as now.
- Building `bog_iron_digger` (Hamlet, no master): its worker digs Swamp tiles in its radius, slowly, for ordinary `iron_ore` to its yard.
- Draining a tile loses its ore for good. The Drain's placement preview says how much bog iron it would lose.
- The tile's ore shows when a Swamp tile is selected or the digger is placed.

## Done when

- Headless tests: the digger gathers iron ore from Swamp; a dug tile refills at spring up to its cap; a Drained tile has none.
- `pnpm check` passes.

## Comments

2026-10-01 — Done. Swamp holds up to 2 iron ore a tile (content `TerrainDef.ore`); `map.oreDug` keeps what's been dug since spring, emptied at spring's first Dawn. The bog-iron digger (Hamlet, radius 6) shares `systems/digging.ts` with the quarry, clay pit and mine; its worker stands on the tile, about 4 ore a day. A Drained tile is Meadow, so its ore is gone. Selecting a Swamp tile shows its bog iron; a Drain's preview warns how much it loses (`bogIronLost`); placing a digger notes the bog iron in reach (`bogIronNear`). See `docs/decisions.md`.
