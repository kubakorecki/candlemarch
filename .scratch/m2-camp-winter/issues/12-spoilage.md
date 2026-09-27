# Food spoilage

Status: ready-for-agent
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
