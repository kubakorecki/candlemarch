# Rank system and rank buildings

Status: resolved
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

## Comments

- 2026-10-01: Done. Content `ranks` (Camp, Hamlet, Village, Town: rank building, residents, unlocked buildings; every placeable building in exactly one list) and `state.rank` (old saves at Camp). `sim/ranks.ts`: `rankLock` (not unlocked yet, or a rank building short of residents) gates `canPlaceBuilding`; construction calls `rankUp`; `rankProgress` for the HUD. Differs from the ticket: the village hall itself joins content here (40 logs, 20 stone, 10 residents, Proposed), since the system needs a Hamlet building to test; ticket 05 keeps the Hero's recovery, tuning and art. Village and Town have no rank building yet, so nothing shows past Hamlet. Locked build cards are dimmed with what they wait for rather than hidden. The rank and its next step show in the Almanac. Tests in `sim/test/ranks.test.ts` (a test Content marks the woodcutter's hut Hamlet for the unlock case) and `client/test/rankText.test.ts`. Not looked at in the browser.
