# Camp scenario survives the first winter

Status: ready-for-agent
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
