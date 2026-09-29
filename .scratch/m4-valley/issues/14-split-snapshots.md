# Worker steps in place; snapshots split into moving and static parts

Status: resolved
Type: task
Blocked by: 02

## What

The worker-side share of `docs/adr/0004-valley-size-and-budget.md`.

- **In-place stepping:** the sim worker owns its state and advances it with `stepInPlace`, so it no longer copies the state every tick. `step()` keeps copying, so tests can still hold old states. The interpolation positions (`prevPositions`) must still come from the previous tick.
- **Split snapshots:**
  - The **moving part** (villagers, the Hero, Gloamlings, building and Stockpile stock, clock, alerts: everything but the static layers) goes every frame, as now.
  - The **static layers** (terrain, map objects, Roads, and later Fog's Revealed tiles and Reserves) go only when they have changed.
  - The sim bumps a version counter in state whenever it changes a static layer. The worker compares it with the last one it sent.
- The main thread keeps the last static layers and joins them with each moving part before rendering.

## Done when

- A headless test proves every change to a static layer bumps its version (felling a tree, finishing a Road, a terrain change), and a tick without such a change doesn't.
- Determinism and save/load tests pass; the game plays as before in the browser.
- `pnpm bench:maps` measures the moving part and the static layers separately. At 128² its numbers are appended to `.scratch/m4-valley/benchmark.md`.
- `pnpm check` passes.

## Comments

2026-09-29 — Done. The worker owns its state and steps it with `stepInPlace`, copying positions before a batch's last tick for `prevPositions`. `sim/src/snapshot.ts` adds `state.staticVersion` (`staticChanged`), bumped when terrain, a Road or a map object (added, removed, `amount`, `withered`) really changes, and `movingPart`/`staticLayers`/`joinSnapshot`. The worker posts the static layers only when the version moved since it last sent them (always for a new or loaded game); `SimBridge` keeps them and joins each moving part. Differs from the issue: no code changes terrain yet, so the terrain part of the test is a 3000-tick busy-grove run asserting the layers change on exactly the ticks the version moves. Every chop changes a tree's `amount`, so the layers go out in about 1 of 18 snapshots at 3× in the benchmark village (428 KB, ~5 ms a side at 128²); noted in `benchmark.md` for ticket 15. `bench:maps` now times ticks with `stepInPlace` and prices the whole state, moving part (33 KB, 0.4 ms) and static layers separately; 128² numbers appended to `benchmark.md`. Checked in Node that the worker's joined snapshots equal a `step`-driven run over 6000 ticks with roads and Hero chopping, and that the built client renders the camp as before in headless Chrome.
