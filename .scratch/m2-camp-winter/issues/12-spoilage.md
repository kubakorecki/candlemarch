# Food spoilage

Status: resolved
Type: task
Blocked by: 02, 11

## What

Model: [ADR-0002](../../../docs/adr/0002-spoilage-daily-share.md).

- Content per food: `spoilPercent` per day (Proposed: berries 35, mushrooms 35, fish 25, meat 25), and a `winterSpoilPercent` multiplier for all food (Proposed 20).
- At each Dawn, every food stack in a Granary or workplace buffer loses `ceil(amount × rate / 100)`, where in winter `rate = trunc(spoilPercent × winterSpoilPercent / 100)` (log the rounding choice). Stores in ID order.
- Food in a villager's or the hero's hands doesn't spoil.
- Leave a clear place for M6's root cellar to lower the rate by a percentage.
- Eating order (ticket 11) now uses these rates.

## Done when

- Headless tests: food spoils at Dawn by the formula; different foods differ; a stack of 1 goes; winter is slower; hands don't spoil; determinism, save/load.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done: Food's `spoilPercent` in content (fish 25; `ResourceDef` is now `GoodsDef | FoodDef`, so every Food must have one), `spoilageSystem` at each Dawn after the first over every building's `stock` and `input` in ID order, `ceil` per stack in integers, and eating order by rate then ID. Differs: the winter multiplier is a per-season `spoilPercent` in the calendar (winter 20, others 100) rather than one `winterSpoilPercent`, like `riverFrozen`, so the sim never asks "is it winter"; the formula is the same. Berries, mushrooms and meat get their rates when tickets 08 and 10 add them. The root cellar's place is `storeSpoilPercent` in `sim/src/systems/spoilage.ts`. Details in `docs/decisions.md`.

