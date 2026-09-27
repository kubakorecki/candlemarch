# Camp scenario survives the first winter

Status: resolved
Type: task
Blocked by: 04, 06, 08, 09, 10, 12, 16, 17, 22

## What

Spec: Progression, "Starting Camp".

- A hand-made Camp map: forest with berry bushes and mushroom patches, one Hunting ground, a river, an entry tile. Start at Dawn of spring day 1 with a Granary holding 20 meat, a 2×2 Stockpile holding 30 logs, and 5 settlers (Carriers, Homeless) plus the hero at the entry tile. No Houses or Workplaces.
- A scripted "sensible layout" as a command list.
- Headless test: with the layout, the village is alive at spring of year 2. Without firewood it dies with alerts first.
- The same scenario in the balance harness.

## Done when

- Both tests pass; tick limits are measured and logged in `docs/decisions.md`.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done. New map `camp` (default for new games) with start goods from `MapDef` (`buildings[].stock`, `stockpiles[].goods`); scenarios `camp` and `campNoFirewood` in `tooling/balance/scenarios.ts`; tests `tooling/balance/camp.test.ts` (alive at Y2 Spring 1, no deaths) and `campNoFirewood.test.ts` (all freeze on winter day 3; "no firewood" from autumn day 1, "will freeze" before the first death). The balance table shows Carrier utilization (`Busy`). The sensible layout needs worker-limit changes (woodcutter off after spring, chopping block for one day): with four Workplaces on five settlers the lone Carrier sits at 99% and the village starves in summer. Sensible run: 5 alive, 0 deaths, Food 38 at winter's first Dawn and 9 at Y2 Spring 1, firewood 26 made, 16 left; no Newcomer came (Food after Dawn's spoilage peaked just under the 30 needed). No content numbers changed. Tick limits and run times in `docs/decisions.md`.
