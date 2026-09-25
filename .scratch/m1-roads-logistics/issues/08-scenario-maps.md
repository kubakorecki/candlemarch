# Logistics scenario maps

Status: ready-for-agent
Type: task
Blocked by: 04, 05, 06, 07

## What

- Extend `MapDef` so a map can start with paths, flags and stockpiles (e.g. extra legend characters or lists; keep it readable in review).
- `createInitialState` takes the logistics model as a parameter (default: job dispatch).
- Three maps in `sim/src/maps/`, each with a fixed Carrier count:
  - **short haul**: woodcutter's hut a few tiles from a stockpile.
  - **long haul**: woodcutter's hut far from a stockpile, joined by a long path.
  - **branching network**: two woodcutter's huts, one stockpile, one pre-placed site, a branching road with several Flags.
- Export a map registry so the client can list them.

## Done when

- For each scenario and each model, a headless test runs N ticks and asserts that logs reached the stockpile (and the site, in the branching map). N is measured and logged in `docs/decisions.md`, like the milestone-0 hut test.
- `pnpm check` passes.
