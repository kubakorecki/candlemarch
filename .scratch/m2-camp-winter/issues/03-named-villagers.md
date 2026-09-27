# Named villagers and a villager panel

Status: resolved
Type: task
Blocked by: m1-roads-logistics/01

## What

- Content: a pool of medieval first names (≥ 60).
- Every villager gets a name when spawned, drawn with the seeded PRNG in state (its first use). Duplicate names are allowed but avoided while unused names remain.
- Client: clicking a villager opens a panel with name, Job and Workplace. Later tickets add home and needs.
- Add the new component field to `normalizeLoadedState` (give missing names deterministically, e.g. by ID).

## Done when

- Headless tests: names are deterministic per seed; save/load keeps them.
- `pnpm check` passes.

## Comments

2026-09-27 — Done in `ce412a5` (content, sim, client: name villagers and add a villager panel).
