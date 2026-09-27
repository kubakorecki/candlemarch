# Warmth: Houses burn firewood in winter; Cold

Status: resolved
Type: task
Blocked by: 06, 13

## What

Spec: Villagers, "Daily life and survival".

- Houses have a firewood buffer (content, 5) and are demands for firewood from the start of autumn to the end of winter.
- In winter, at Dusk, each occupied House burns 1 firewood (content, per House not per resident). If it can't, it's cold that night.
- A villager who spends a winter night in a cold House or in the open gets a **cold night**. A per-villager count of cold nights in a row; at 1 or more they're **Cold**: 50% slower, through the shared slowdown helper (worst applies). A warm night resets the count. Death at the limit is ticket 15.
- House buffers count toward the chopping block's firewood target (ticket 06).
- The hero never gets cold.
- Client: a "no firewood" icon on cold Houses; a Cold icon on villagers; the panel shows it.

## Done when

- Headless tests: firewood is delivered from autumn and burned at winter Dusks; a House without it goes cold; its residents become Cold and recover after a warm night; Homeless villagers get cold in winter only; determinism, save/load.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done: `content.needs.cold`, House fuel buffers and `house` demands, `warmthSystem` (winter Dusk burn, Dawn cold-night count) before the routine, Cold in `speedPercent`, House fuel in the firewood target, client icons (snowflake on villagers, struck-through firewood on cold Houses), a Cold count in the readout and a panel row. A night counts as warm only when the villager is asleep at its warm Home at Dawn (one still walking home had a cold night); an unlived-in House isn't lit, so a villager housed mid-night is cold. No existing test changed. Details in `docs/decisions.md`.
