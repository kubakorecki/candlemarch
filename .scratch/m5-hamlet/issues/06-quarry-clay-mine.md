# Quarry, clay pit and mine

Status: ready-for-agent
Type: task
Blocked by: m4-valley/05, m1-roads-logistics/06

## What

Raw gatherers that don't need a master. Deposits reuse the generic map-object fields (`resource`, `amount`, `gatherTicks`, `yieldPerGather`).

- Content: resources `stone`, `clay`, `iron_ore` (stockpile). Map objects: stone deposit (on rock), clay deposit (on riverbank), iron vein (on mountain).
- Buildings: `quarry`, `clay_pit`, `mine`, each gathering its deposit in a radius.
- Stone and ore deplete and never return; clay depletes slowly.
- Hand-made map legend characters for deposits.

## Done when

- Headless tests per building: gathers, fills its buffer, deposit depletes.
- `pnpm check` passes.
