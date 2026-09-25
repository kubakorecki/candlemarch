# Gate: playtest A vs B and pick a logistics model

Status: ready-for-human
Type: playtest
Blocked by: 08, 09, 10

## What

The owner plays each scenario map under job dispatch and flag relay and judges:

- Belt feel: does the network look and behave like conveyor belts?
- Bottlenecks: can you see where and why goods stall?
- Layout friction: is laying roads and flags fun or fiddly?

Then:

1. Record the choice as `docs/adr/0001-logistics-model.md` (context, the pick, why, what was given up).
2. Delete the losing model and its tests (git history keeps it). Keep the `LogisticsModel` interface only if the winner still benefits from it; otherwise inline it.
3. Update `docs/spec.md` Logistics section and close the open question.
4. Revisit the `needs-info` tickets that list this one: `m1-5-hero-playtest/02`, `m2-camp-winter/19`, `m6-village/12`, `m6-village/13`.

## Done when

- ADR-0001 exists, the loser is gone, and `pnpm check` passes.
