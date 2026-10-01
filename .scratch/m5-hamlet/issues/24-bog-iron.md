# Bog iron

Status: ready-for-agent
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
