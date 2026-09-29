# Renderer performance at 128²

Status: ready-for-agent
Type: task
Blocked by: 04, 14

## What

The client's share of `docs/adr/0004-valley-size-and-budget.md`. Where the time goes is in `.scratch/m4-valley/benchmark.md` ("Renderer").

- **Per-snapshot work:** `syncStatics` visits every map object and builds a key per object on every snapshot, and joins the whole terrain array into a string. Resync statics only when the static layers change (ticket 14). Read each Forage patch's shade from state (ticket 04) instead of running `isWithered` on the main thread.
- **Culling:** don't draw what's off-screen, at every zoom.
- **Batching:** the ground and trees are drawn as cached or batched layers, not one `Graphics` per tree in one sorted container. Depth sorting against villagers and buildings must still look right.

## Done when

- At 128² on the synthetic map, running at 3× while panning and zooming: 60 fps, frame p95 ≤ 20 ms, main-thread snapshot handling ≤ 4 ms. Measured the way the benchmark's page did (branch `prototype/m4-map-size-page`, rebased, or an equivalent), in a real browser window if one is available. Numbers appended to `.scratch/m4-valley/benchmark.md`.
- No visible change except speed.
- `pnpm check` passes.
