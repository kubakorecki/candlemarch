# Valley balance scenario

Status: resolved
Type: task
Blocked by:

## What

Measure before tuning.

- `tooling/balance/scenarios.ts`: a `valley` scenario on `generateValley(1, content)`, Fog off, to Dawn of Y2 Spring 1. A scripted sensible layout: day 1 a woodcutter's hut at the east wood, a fisher's hut on the north bank, a hunter's lodge at the north wood and a Hut; day 3 a second Hut; day 5 a forager's hut; about day 8 a chopping block. Resolve coordinates once with `canPlaceBuilding`, then hard-code them like `campLayout`.
- The harness fails loudly when a scripted `placeBuilding` doesn't place.
- The harness reports Food made each day (what gatherers put in their buffers), so each source's output shows.
- CLAUDE.md's `pnpm balance` list includes `valley`.

No pass/fail scenario test yet: 05 adds it.

## Done when

- `pnpm balance valley` prints the year; the baseline table is recorded below.
- `pnpm check` passes.

## Comments

2026-09-30 — Done. `scenarios.valley` (seed 1, Fog off, `monsterRate: 0` via a new optional `Scenario.monsterRate`: with the default rate Gloamlings killed 3 by summer and hid the food picture). The harness throws when a scripted `placeBuilding` doesn't place, and reports `made` per Food ("+Fish" … columns). Layout: woodcutter's hut (27,58), fisher's hut (11,38) turned north (the nearest bank; the walk goes round the north wood), hunter's lodge (20,51), Huts (13,57) and (15,57), forager's hut (28,44), chopping block (14,52).

Found on the way: the bank east of the north wood (31,37) is walled off from the Camp by the two woods (only reachable round the east wood's south end, ~100 tiles); a forager's hut at (22,44) turned west closes its own door into a pocket and placement allows it (the site then waits forever). 03 removes both.

Baseline (`pnpm balance valley`): everyone starves by Summer 4. The hunter makes 4 meat a day for 4 days and stops with 4 hides in the lodge (02's bug); the fisher makes ~1 fish a day; the forager's hut (placed day 5) is never finished: two Carriers can't keep up.

```
Date         Pop  Starved  Fish  Meat  Hides  +Fish  +Meat
Y1 Spring 1    5        0     0    20      0      0      0
Y1 Spring 3    5        0     1    10      1      1      4
Y1 Spring 5    5        0     2     6      3      4      4
Y1 Summer 1    5        0     4     7      4      3      4
Y1 Summer 2    5        0     4     5      4      1      0
Y1 Summer 3    3        2     4     3      4      1      0
Y1 Summer 4    0        5     3     2      4      0      0
```
