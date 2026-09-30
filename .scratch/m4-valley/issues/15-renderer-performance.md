# Renderer performance at 128²

Status: resolved
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

## Comments

2026-09-30 — Done. `syncStatics` looks at the ground, Roads and map objects only when they're new objects, and then redraws only what changed (a terrain compare; a per-object diff, `render/mapObjectRuns.ts`); patches' shade comes from `mapObject.withered`. Trees and forage patches are drawn a row run to a `Graphics` (one diagonal, 16 tiles), which sorts against villagers and buildings exactly as single trees did; the ground in 16×16-tile chunks drawn a layer at a time (`render/mapLayers.ts`). Ground chunks, runs, statics and walkers off-screen are culled at every zoom; `world` and `objects` are Pixi render groups. Beyond the issue: the known problem from 14 (every chop resent 428 KB of static layers, ~5 ms on the main thread) is fixed with static patches (`staticPatch`/`applyStaticPatch` in `sim/src/snapshot.ts`; 135 B mean), because separate terrain/map-object versions would still have sent ~300 KB per chop. Measured with the benchmark page redone on this branch in a throwaway worktree, headless Chrome on the real GPU (no visible window available): 128² at 3× while panning and zooming, 60.0 fps, frame p95 19.0–19.7 ms, snapshot handling ~1 ms mean (p95 ≤ 1.8, worst 4.3 once); numbers in `benchmark.md`. Screenshots at 64² and 128² match the old renderer to a few anti-aliasing pixels. `bench:maps` reports patch sizes.
