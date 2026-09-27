# Immigration

Status: resolved
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

## Comments

- 2026-09-27 — Done: `content.immigration` (5 Meals a head, closed in winter), `MapDef.entry` → `state.map.entry` (every built-in map has one; buildings can't cover it), `immigrationSystem` after routine at each Dawn but the first. The Newcomer is a Carrier on the entry tile with a Home (nearest House with room the entry can reach) and routine `goingHome`; it switches to `work` when it arrives. Beyond the issue: Homeless villagers get first pick of places freed by that Dawn's deaths, and a House the entry can't reach doesn't count as a free place. `newcomerHome` and `immigrationFoodNeeded` are exported for alerts. No client change: Newcomers draw as villagers.
