# Quarry, clay pit and mine

Status: ready-for-agent
Type: task
Blocked by: m4-valley/05, m4-valley/07, m1-roads-logistics/06

## What

Raw gatherers that don't need a master. Deposits reuse the generic map-object fields (`resource`, `amount`, `gatherTicks`, `yieldPerGather`).

- Resources `stone`, `clay`, `iron_ore` and the Deposit map objects (`stone_deposit` on Rock, `clay_deposit` on a Riverbank, `iron_deposit` on a Mountain face) already exist from `m4-valley/05`, and the generator places them. Tune their amounts here.
- Buildings: `quarry`, `clay_pit`, `mine`, each gathering its Deposit in a radius. The quarry may stand on Rock (the one exception to Rock being unbuildable). A mine on the Abandoned mine POI costs less.
- Stone and ore deplete and never return; clay depletes slowly.

## Done when

- Headless tests per building: gathers, fills its buffer, deposit depletes.
- `pnpm check` passes.

## Comments

2026-09-29 — M4 design session (m4-valley/03): Deposits and their resources move to `m4-valley/05` so the M4 generator can place them; the glossary term is Deposit, not "vein". Iron Deposits are only in the Side valley, behind the Pass. What happens when a Deposit runs out is a question for design session 02.
