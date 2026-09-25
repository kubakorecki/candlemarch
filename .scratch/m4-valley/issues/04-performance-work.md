# Performance work for the chosen map size

Status: needs-info
Type: task
Blocked by: 02

## What

Whatever the map-size gate decides is necessary, for example:

- Replace the per-tick JSON deep copy in `step()` with in-place mutation plus a cheaper way to keep old states in tests.
- Send diffs instead of full snapshots to the main thread.
- Cache static layers in the renderer; cull off-screen objects.

## Open questions (gate 02)

- Which of these are needed.

## Done when

- The benchmark meets the budget; determinism and save/load tests still pass.
- `pnpm check` passes.
