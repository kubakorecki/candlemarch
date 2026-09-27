# Immigration

Status: ready-for-agent
Type: task
Blocked by: 11, 13

## What

Spec: Villagers, "Population".

- Maps define an `entry` tile at the map edge.
- Checked at each Dawn. One Newcomer arrives when all hold: at least one free House place; food in Granaries ≥ 5 Meals × (population + 1) (content); not winter.
- The Newcomer appears at the entry tile, gets a name and a Home, walks there and starts as a Carrier.

## Done when

- Headless tests: arrives when conditions hold, not otherwise (no place, too little food, winter); at most one per Dawn; deterministic timing; save/load.
- `pnpm check` passes.
