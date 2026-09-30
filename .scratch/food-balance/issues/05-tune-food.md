# Tune food to the target and pin it

Status: ready-for-agent
Type: task
Blocked by: 03, 04

## What

Reach spec.md's target on the `valley` scenario, changing one Proposed number at a time:

- `immigration.mealsPerHead` 5 → about 2.
- Berry bush stock spring 3 → 5, summer 8 → 10 (autumn stays 0; mushrooms carry autumn).
- `valley.forest.foragePercent` 5 → about 8, and a berry-bush guarantee near the Camp in `valley.guarantees`.
- Only if still short: the Camp's riverbank closer than 17 tiles.

## Done when

- `tooling/balance/valley.scenario.test.ts`: Y2 Spring 1, no deaths, population ≥ 6. `camp` and `nights` still pass.
- The spec's Proposed numbers and `docs/decisions.md` (before/after tables) updated.
- `pnpm check` passes.

## Comments
