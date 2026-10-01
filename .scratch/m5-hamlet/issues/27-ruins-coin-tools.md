# Coin and tools in Ruins Caches

Status: ready-for-agent
Type: task
Blocked by: 14, 16

## What

Spec: World and map (Points of interest: Ruins).

- A searched Ruins' Cache also gives 50 coin (straight to the Treasury when the Hero finds it) and 2 tools (loose in the Cache, picked up like the rest), each ±30% from the PRNG.

## Done when

- Headless test: Searching a Ruins adds coin to the Treasury and tools to the Cache; determinism.
- `pnpm check` passes.
