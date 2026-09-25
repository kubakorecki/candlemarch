# Camp scenario survives the first winter

Status: needs-info
Type: task
Blocked by: 04, 08, 09, 10, 12, 16, 17

## What

- A hand-made Camp map (hero + 5 settlers, forest, river) with the starting kit from design session 01.
- A scripted "sensible layout" as a command list.
- Headless test: with the layout, the village is alive at spring of year 2. Without firewood it dies with alerts first.
- The same scenario in the balance harness.

## Done when

- Both tests pass; tick limits are measured and logged in `docs/decisions.md`.
- `pnpm check` passes.
