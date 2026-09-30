# Tune food to the target and pin it

Status: resolved
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

2026-09-30 — Done. `valley` reaches Y2 Spring 1 with 6 villagers, nobody lost (`valley.scenario.test.ts`). Differs from the issue: the scenario layout was rewritten (lean, worker limits, a second Stockpile, no fisher: the greedy one left no Carriers whatever the numbers); more levers than listed were needed (Spoilage 15%/25%, Hunting grounds 1 Game per 5 trees, forager baskets of 3 with a 6-slot hut buffer, mushroom patches 12); the riverbank distance was left alone; no new berry-bush guarantee (10% forage gives every seed 1–100 at least 6 bushes within 20 tiles). The generator's `connect` now walks through trees instead of felling them (10% forage otherwise broke the trees-near-Camp guarantee on 16 seeds in 100). See `docs/decisions.md`.
