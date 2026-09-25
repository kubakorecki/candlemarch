# Procedural valley generator

Status: needs-info
Type: task
Blocked by: 02, 03, 05

## What

- `generateValley(seed, settings, content)` in `sim` produces a `MapDef`-like layout: terrain, river, forests, deposits, the Camp start. Deterministic: seeded PRNG only.
- Guarantees from the design session (e.g. forest and river near the start) are checked, and the generator retries with a derived seed if they fail.
- `createInitialState` can start from a generated valley.

## Open questions (design session 03, Q1, Q5)

- Shape and placement rules.

## Done when

- Headless tests: same seed → identical valley; guarantees hold across 100 seeds; generation is fast enough for the budget.
- `pnpm check` passes.
