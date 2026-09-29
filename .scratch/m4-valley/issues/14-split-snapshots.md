# Worker steps in place; snapshots split into moving and static parts

Status: ready-for-agent
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
