# Quarry, clay pit and mine

Status: ready-for-agent
Type: task
Blocked by: m4-valley/05, m4-valley/07, m1-roads-logistics/06, 04, 23

## What

Raw gatherers that don't need a master. Deposits reuse the generic map-object fields (`resource`, `amount`, `gatherTicks`, `yieldPerGather`). Spec: World and map (Deposits).

- Resources `stone`, `clay`, `iron_ore` and the Deposit map objects exist from `m4-valley/05`; ticket 23 places them in groups.
- Buildings: `quarry` (Camp), `clay_pit` and `mine` (Hamlet), each gathering its Deposits in a radius. The quarry may stand on Rock (the one exception to Rock being unbuildable). A mine on the Abandoned mine POI costs less.
- Amounts: one Deposit lasts about 2 seasons of digging by one worker. Measure a worker's rate and set each Deposit's `amount` from it; log the numbers in `docs/decisions.md`.
- Stone and iron ore never come back. At the start of each spring every clay Deposit regains ¼ of its starting amount, up to that amount, even once empty.
- An empty Deposit stays on the map and is drawn dug out. It keeps the walking rule Deposits have now.

## Done when

- Headless tests per building: gathers, fills its yard, the Deposit depletes; an empty clay Deposit refills at spring; stone doesn't.
- `pnpm check` passes.

## Comments

2026-09-29 — M4 design session (m4-valley/03): Deposits and their resources move to `m4-valley/05` so the M4 generator can place them; the glossary term is Deposit, not "vein". Iron Deposits are only in the Side valley, behind the Pass. What happens when a Deposit runs out is a question for design session 02.

2026-10-01 — Design session 02: groups (ticket 23), amounts, clay refill and "left dug out" added; quarry at Camp, clay pit and mine at Hamlet.
