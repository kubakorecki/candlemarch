# Rank system and rank buildings

Status: ready-for-agent
Type: task
Blocked by: 01

## What

Spec: Progression (the rank table, Rank requirements).

- State: the village's current Rank (Camp, Hamlet, Village, Town).
- Content: per rank, its rank building, its resident requirement and its unlocks (buildings, Charters, features).
- A rank building can be placed only while its resident requirement holds; the build menu shows "needs 10 residents: 7/10". Its goods are its construction cost, delivered like any site's. (Coin as part of a construction cost comes with ticket 14; the village hall needs none.)
- Completing the rank building raises the rank.
- Unlocks: the Camp has the quarry (ticket 06 adds it); Hamlet unlocks the trade post, notice board, clay pit, mine, bog-iron digger, farm, charcoal kiln and every M5 master workshop. The tickets that add those buildings mark them Hamlet.
- The build menu shows only unlocked buildings; locked ones say what unlocks them. The HUD shows the rank and progress toward the next.

## Done when

- Headless tests: placing the rank building is refused below its resident requirement and accepted at it; completing it ranks up; unlocks appear; determinism.
- `pnpm check` passes.
