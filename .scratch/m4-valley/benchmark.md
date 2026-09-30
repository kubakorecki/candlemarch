# Map-size benchmark

Facts for the map-size gate (ticket 02). No decision here.

## Summary

Against the reference points below (3× leaves 16.7 ms a tick; a 60 fps frame is 16.7 ms):

- **64²** stays under both everywhere: `step` mean 4.3 ms (p95 15 ms), 60 fps at 1× and 3×.
- **128²**: `step` mean 16.5 ms, right at 3×'s 16.7 ms on average and well over it on busy ticks (p95 61 ms). The page renders 60 fps paused and 43–60 fps running, because each snapshot costs the main thread about 21 ms.
- **192² and 256²** are over both in the sim (`step` mean 39 and 77 ms), the renderer (30 and 13 fps with the game paused) and snapshot handling (about 145 and 560–910 ms of main thread per snapshot).
- The per-tick JSON copy is 9–16% of `step`. What grows with the map is elsewhere. In the sim: map-wide flood fills (`travelCosts` plus rebuilding the walk grid) and `isWithered` (forage patches × trees). On the client: `syncStatics` revisits every object per snapshot (with `isWithered` again), there's one Pixi object per tree and no culling, and every snapshot structured-clones the full state (25 ms at 256²).

Measured 2026-09-28 on an Apple M1 Pro, Node 22.16, Chrome 153 (headless, ANGLE Metal on the M1 Pro GPU, 1512×860 at 2× device pixels), at commit `d1bde4b` plus this ticket.

## Setup

- **Maps.** `tooling/benchmark/syntheticMap.ts` builds a `size`×`size` map: the same working village in the middle at every size, forest in value-noise patches over roughly two fifths of the land, a river across the map. The village has 50 villagers (24 workers at 24 Workplaces: woodcutters, hunters, foragers, fishers, chopping blocks, watchtowers; 26 Carriers), 18 Huts, 2 Granaries full of meat, 3 Stockpiles, dirt paths to a west-edge entry, the Hero, and two Hunting grounds. No Dens, so no Gloamlings. What grows with the map is terrain, trees and forage patches (berry bushes, mushrooms).
- **Sim** (`pnpm bench:maps`). Per size: `createInitialState`; 600 warm-up ticks so everyone is at work; then one in-game day (3,600 ticks, with Dusk, night and Dawn) timed tick by tick with `step`, as the worker runs them (the JSON deep copy `cloneState`, then the tick). Then, from the same state, 200 ticks run both with `step` and with `stepInPlace` (the tick without the copy): the sim is deterministic, so the only difference is the copy. The copy share is (paired `step` − paired `stepInPlace`) / paired `step`. `cloneState` is also timed on its own. State size is `serialize(state)`. Snapshot transfer: a `worker_threads` worker posts a `{type, state, prevPositions}` message shaped like the sim worker's (`prevPositions` a separate object, as it comes from the previous tick's state), 20 times. Each sample runs from the post to the main thread's handler: serialize, hand over, deserialize.
- **Renderer** (throwaway page, see below). The real `Game` (sim worker, `SimBridge`, `WorldRenderer`) on the synthetic map, no HUD. After the first snapshot plus 4 s, a script drives the camera through five 6-second phases and times every frame with `requestAnimationFrame`. It also records each snapshot's transfer (worker post → main-thread handler), the main thread's time handling it (`Game.onSnapshot`: `syncStatics` and panels), and the worker's time stepping each batch.

The page was measured in a separate headless Chrome, driven over the DevTools protocol, because the owner's Chrome window was hidden (a hidden page gets no animation frames). Headless Chrome used the real GPU and paced frames at 60 Hz. The owner's own browser and display may give somewhat different frame times.

Reference points (not a budget: setting one is ticket 02's job): 20 ticks a second, so 1× leaves 50 ms of worker time per tick and 3× leaves 16.7 ms. The worker sends one full snapshot per rendered frame (up to 60 a second). A 60 fps frame is 16.7 ms.

## Sim

| Map | Entities | Trees | Forage patches | Villagers | Buildings | Road tiles | Create (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64² | 1524 | 1357 | 36 | 50 | 44 | 64 | 29.87 |
| 128² | 5440 | 5191 | 118 | 50 | 44 | 96 | 54.10 |
| 192² | 13130 | 12716 | 284 | 50 | 44 | 128 | 125.37 |
| 256² | 23539 | 22870 | 538 | 50 | 44 | 160 | 334.15 |

| Map | `step` mean (ms) | `step` p95 | `step` max | Copy alone (ms) | Paired `step` (ms) | Paired `stepInPlace` (ms) | Copy share (paired) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64² | 4.27 | 14.89 | 85.62 | 1.14 | 7.32 | 6.13 | 16% |
| 128² | 16.46 | 60.61 | 271.78 | 3.69 | 24.89 | 22.34 | 10% |
| 192² | 38.53 | 130.25 | 746.60 | 8.66 | 62.91 | 57.46 | 9% |
| 256² | 77.41 | 329.45 | 1870.20 | 15.88 | 132.88 | 115.92 | 13% |

- The `step` columns cover one whole day, as the worker runs it (copy included): the mean, 95th percentile and worst tick. The paired window is 200 busy daytime ticks from the end of that day, so its per-tick numbers sit above the day mean.
- Where tick time goes (V8 CPU profile of `stepInPlace`, self time from the start of a run: 4,200 ticks at 64², 1,800 at 256²):
  - **64²**: the map-wide flood fills. About two thirds goes to `travelCosts` (Dijkstra over the whole map) and the walk grid it needs (`blockedGrid`, `speedPercentGrid`/`speedPercentAt`, rebuilt per call). Job dispatch runs it for each idle Carrier every `idleRetryTicks` (20), and homes and Granary lookups run it too. `idsOf` (sorting store keys) takes about 10%.
  - **256²**: `isWithered` alone takes 50%. Each forage-patch check scans every map object for a shading tree (patches × trees), and foragers check every patch when they look for work. GC takes 12%, and the flood fills and walk grid about 30%.
- The copy is not what dominates: its share of `step` is 9–16% across sizes. Copy alone is 1.1 ms at 64² and 16 ms at 256². The tick without the copy is about the `step` mean minus the copy: about 13 ms at 128², 30 ms at 192², 62 ms at 256².
- Worst ticks: 86 ms (64²), 272 ms (128²), 747 ms (192²), 1.9 s (256²). Which ticks these are wasn't profiled.

## Worker → main snapshot

| Map | State (JSON) | Gzipped | Snapshot transfer mean (ms) | Transfer p95 | Transfer max | `structuredClone` (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| 64² | 140 KB | 15 KB | 1.75 | 1.87 | 1.87 | 1.51 |
| 128² | 457 KB | 41 KB | 5.50 | 5.59 | 5.59 | 4.73 |
| 192² | 1065 KB | 91 KB | 13.70 | 15.15 | 15.15 | 13.39 |
| 256² | 1907 KB | 161 KB | 24.65 | 27.23 | 27.23 | 21.95 |

- The state grows with the map: about 60 bytes of JSON per entity, nearly all of them trees (a `tile` and a `mapObject` each), plus about 8 bytes per tile for the `terrain` array.
- Transfer is almost all structured-clone cost, paid on both threads. One snapshot per frame at 60 fps would need 1.5 s of transfer a second at 256². In practice `SimBridge` keeps one request in flight, so snapshots and ticks slow down instead.

## Renderer (throwaway page)

### Running at 1×

**64²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 17.1 | 19.1 | 0 | 1.4 | 3.4 | 2.7 | 9.2 |
| pan, zoom 0.6 | 60.0 | 16.7 | 17.3 | 21.8 | 0 | 1.3 | 1.6 | 2.8 | 6.9 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 17.1 | 18.7 | 0 | 2.2 | 3.1 | 3.0 | 2.2 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 17.0 | 17.5 | 0 | 2.2 | 2.8 | 3.0 | 2.0 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 17.1 | 17.7 | 0 | 2.3 | 2.9 | 3.0 | 1.9 |

**128²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 56.7 | 17.6 | 36.7 | 38.8 | 43 | 7.5 | 13.9 | 20.2 | 46.8 |
| pan, zoom 0.6 | 48.0 | 20.8 | 36.1 | 38.6 | 92 | 9.3 | 17.1 | 21.1 | 26.5 |
| pan, zoom 0.25 (out) | 44.6 | 22.4 | 35.4 | 39.3 | 97 | 9.9 | 16.0 | 20.8 | 7.3 |
| pan, zoom 1.5 (in) | 42.9 | 23.3 | 35.8 | 39.4 | 108 | 10.4 | 16.5 | 21.4 | 6.9 |
| zooming 0.25–2.5 | 42.8 | 23.4 | 36.1 | 39.7 | 109 | 10.4 | 16.2 | 21.5 | 6.9 |

**192²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 6.2 | 162.1 | 190.3 | 281.6 | 30 | 54.5 | 78.6 | 146.4 | 160.7 |
| pan, zoom 0.6 | 6.5 | 154.9 | 187.2 | 273.8 | 36 | 57.8 | 128.0 | 145.9 | 170.0 |
| pan, zoom 0.25 (out) | 5.6 | 177.7 | 206.4 | 206.4 | 31 | 99.5 | 157.8 | 139.7 | 115.2 |
| pan, zoom 1.5 (in) | 5.6 | 179.0 | 208.9 | 211.9 | 31 | 105.1 | 153.8 | 140.9 | 111.3 |
| zooming 0.25–2.5 | 6.2 | 162.3 | 199.8 | 234.7 | 34 | 132.7 | 198.3 | 140.3 | 86.8 |

**256²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 1.7 | 587.1 | 1032.1 | 1032.1 | 9 | 440.0 | 751.3 | 670.9 | 380.1 |
| pan, zoom 0.6 | 2.9 | 348.6 | 769.0 | 769.0 | 16 | 374.3 | 602.2 | 557.7 | 392.1 |
| pan, zoom 0.25 (out) | 6.6 | 151.5 | 740.1 | 1189.7 | 34 | 388.3 | 962.5 | 752.9 | 951.2 |
| pan, zoom 1.5 (in) | 8.0 | 125.5 | 628.1 | 1145.7 | 44 | 259.0 | 458.3 | 686.1 | 966.1 |
| zooming 0.25–2.5 | 6.6 | 151.9 | 696.5 | 1185.9 | 34 | 262.0 | 502.6 | 732.6 | 1086.6 |

### Running at 3×

**64²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 18.0 | 19.0 | 0 | 1.9 | 4.0 | 2.8 | 2.4 |
| pan, zoom 0.6 | 60.0 | 16.7 | 17.9 | 18.6 | 0 | 2.3 | 19.3 | 2.7 | 1.8 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 17.8 | 18.6 | 0 | 2.2 | 3.5 | 2.8 | 1.9 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 17.9 | 19.2 | 0 | 2.2 | 3.7 | 2.8 | 1.9 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 17.9 | 19.8 | 0 | 1.2 | 4.2 | 2.6 | 8.6 |

**128²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 59.8 | 16.7 | 32.5 | 40.2 | 10 | 8.0 | 13.0 | 20.6 | 271.3 |
| pan, zoom 0.6 | 43.5 | 23.0 | 38.1 | 40.4 | 97 | 10.3 | 18.9 | 21.7 | 24.2 |
| pan, zoom 0.25 (out) | 44.2 | 22.6 | 37.0 | 40.4 | 101 | 9.9 | 17.1 | 21.4 | 22.6 |
| pan, zoom 1.5 (in) | 44.2 | 22.6 | 36.4 | 38.5 | 102 | 10.2 | 17.0 | 21.4 | 22.2 |
| zooming 0.25–2.5 | 46.6 | 21.5 | 37.8 | 42.8 | 83 | 9.6 | 17.4 | 21.8 | 34.6 |

**192²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 27.9 | 35.9 | 32.1 | 194.0 | 6 | 21.2 | 37.0 | 143.8 | 808.5 |
| pan, zoom 0.6 | 21.6 | 46.2 | 184.1 | 210.4 | 119 | 30.5 | 43.4 | 148.3 | 813.3 |
| pan, zoom 0.25 (out) | 19.6 | 50.9 | 181.2 | 183.1 | 111 | 29.6 | 44.9 | 140.9 | 542.0 |
| pan, zoom 1.5 (in) | 15.1 | 66.2 | 188.7 | 245.7 | 83 | 63.3 | 166.4 | 149.2 | 302.7 |
| zooming 0.25–2.5 | 6.8 | 147.0 | 240.9 | 424.7 | 38 | 76.6 | 187.0 | 157.2 | 178.7 |

**256²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms | xfer mean | xfer max | sync mean | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 7.7 | 130.6 | 718.1 | 1319.6 | 42 | 72.0 | 98.6 | 881.8 | 1686.6 |
| pan, zoom 0.6 | 6.7 | 149.0 | 741.5 | 1364.6 | 40 | 34.0 | 48.9 | 757.2 | 1737.0 |
| pan, zoom 0.25 (out) | 9.7 | 102.8 | 92.8 | 938.7 | 43 | 59.0 | 64.5 | 693.3 | 1865.0 |
| pan, zoom 1.5 (in) | 6.0 | 165.8 | 768.4 | 1688.8 | 43 | 68.9 | 107.2 | 913.5 | 1953.7 |
| zooming 0.25–2.5 | 7.2 | 139.0 | 732.8 | 1348.3 | 36 | 34.3 | 58.9 | 816.1 | 1687.1 |

### Paused (the first snapshot only: rendering alone)

**64²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms |
| --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 17.5 | 18.0 | 0 |
| pan, zoom 0.6 | 60.0 | 16.7 | 17.6 | 18.2 | 0 |
| pan, zoom 0.25 (out) | 59.8 | 16.7 | 17.5 | 34.6 | 1 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 17.4 | 18.3 | 0 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 17.3 | 18.1 | 0 |

**128²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms |
| --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 17.4 | 18.2 | 0 |
| pan, zoom 0.6 | 60.0 | 16.7 | 17.8 | 20.1 | 0 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 18.1 | 20.0 | 0 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 17.7 | 18.6 | 0 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 17.9 | 25.0 | 0 |

**192²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms |
| --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 32.7 | 30.5 | 32.8 | 49.3 | 4 |
| pan, zoom 0.6 | 28.9 | 34.5 | 38.9 | 43.0 | 116 |
| pan, zoom 0.25 (out) | 28.6 | 35.0 | 46.9 | 65.8 | 124 |
| pan, zoom 1.5 (in) | 29.4 | 34.0 | 35.5 | 47.4 | 109 |
| zooming 0.25–2.5 | 29.5 | 33.9 | 35.4 | 42.8 | 113 |

**256²**

| Phase | fps | Frame mean | p95 | Max | Frames >33 ms |
| --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 14.1 | 71.0 | 76.7 | 543.0 | 84 |
| pan, zoom 0.6 | 13.1 | 76.1 | 84.9 | 136.9 | 72 |
| pan, zoom 0.25 (out) | 13.2 | 75.8 | 90.3 | 95.8 | 73 |
| pan, zoom 1.5 (in) | 13.3 | 75.2 | 82.1 | 93.5 | 73 |
| zooming 0.25–2.5 | 13.6 | 73.6 | 76.6 | 78.9 | 75 |

Columns: fps and frame times from `requestAnimationFrame` (ms; ">33ms" counts frames that missed two vsyncs); `xfer` = snapshot transfer, worker post → main handler (includes waiting behind the main thread's own work); `sync` = main-thread ms per snapshot in `Game.onSnapshot`; `worker` = worker ms stepping one batch (the ticks since the last snapshot, max 10).

- **Rendering alone** (paused) holds 60 fps up to 128². It drops to about 30 fps at 192² and about 13 fps at 256² at every zoom, zoomed in included, so nothing off-screen is culled. Main-thread profile at 256², paused: Pixi's per-frame walk over every display object (`bind` 15%, `collectRenderables` 14%, `draw` 9%, and more). Every tree, bush and building is its own `Graphics` in one sorted `objects` container, and the ground is one big `Graphics`.
- **Each snapshot** costs the main thread `sync` ms in `Game.onSnapshot`: about 3 ms at 64², 21 ms at 128², 145 ms at 192², 560–910 ms at 256². `syncStatics` visits every map object each snapshot and builds a key per object. For each forage patch that includes `isWithered`, the same patches × trees scan as in the sim, now on the main thread: 42% of the main thread at 256² running at 1×, with GC 18%. It also joins the whole `terrain` array into a string to see whether the ground changed.
- So, running, the frame rate is set by how often snapshots arrive and what each one costs. At 192² the page is mostly faster at 3× (7–28 fps; 28 still, 15–22 while panning) than at 1× (about 6 fps), because the worker takes 180–810 ms per batch at 3×, so fewer snapshots arrive. At 3× the sim can't keep up either way: a batch is at most 10 ticks, and at 192² and 256² it takes 0.2–2 s, where 10 ticks at 3× should take 167 ms.
- 64² holds 60 fps at 1× and 3× in every phase. 128² holds 60 fps paused and drops to 43–60 fps running, with a snapshot `sync` of about 21 ms on top of the frame.
- `xfer` in the browser is larger than the Node transfer at the same size (e.g. 128²: 8–10 ms vs 5.7 ms), because it includes waiting behind the main thread's own frame and snapshot work.

## Running it again

- `pnpm bench:maps [size...]` prints the sim and snapshot tables (about 12 minutes for all four sizes; 256² takes most of it).
- The sim's "where tick time goes" shares come from V8's sampling profiler: a small script that builds `syntheticMap(size)` and runs `stepInPlace`, started with `node --import tsx --cpu-prof` from `tooling/`, with self time summed per function. The page's main-thread shares come from the DevTools protocol's `Profiler` domain over 30 s on the page. Neither script is committed.
- The page lives on branch `prototype/m4-map-size-page`, off main. Check it out, run `pnpm dev`, and open `/prototype-map-size.html?size=256&speed=1` (sizes 64/128/192/256; speed 0 (paused), 1 or 3). The panel shows the last 2 s live, and the button runs the scripted pan/zoom. Add `&auto=1` to run it on load. The worker's `newGame` takes an optional `mapSize` there, and the snapshot carries its post time and stepping ms.

## After the sim performance work (ticket 04)

Measured 2026-09-29, same machine and Node, `pnpm bench:maps` (all four sizes). Budget (ADR-0004, 128²): `step` mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms. Met: 4.40 ms mean, 5.49 ms p95, 39.6 ms max. Two earlier 128²-only runs during the work gave 4.58 / 5.95 / 21.4 ms, so the max moves around by run.

| Map | Entities | Trees | Forage patches | Villagers | Buildings | Road tiles | Create (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64² | 1524 | 1357 | 36 | 50 | 44 | 64 | 24.16 |
| 128² | 5440 | 5191 | 118 | 50 | 44 | 96 | 44.37 |
| 192² | 13130 | 12716 | 284 | 50 | 44 | 128 | 129.14 |
| 256² | 23539 | 22870 | 538 | 50 | 44 | 160 | 528.97 |

| Map | `step` mean (ms) | `step` p95 | `step` max | Copy alone (ms) | Paired `step` (ms) | Paired `stepInPlace` (ms) | Copy share (paired) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64² | 1.58 | 2.43 | 12.19 | 1.22 | 2.06 | 0.77 | 63% |
| 128² | 4.40 | 5.49 | 39.61 | 3.95 | 4.91 | 0.84 | 83% |
| 192² | 9.81 | 11.65 | 51.37 | 10.06 | 10.61 | 0.93 | 91% |
| 256² | 17.89 | 22.32 | 66.86 | 17.13 | 18.57 | 1.08 | 94% |

| Map | State (JSON) | Gzipped | Snapshot transfer mean (ms) | Transfer p95 | Transfer max | `structuredClone` (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| 64² | 141 KB | 15 KB | 1.76 | 1.95 | 1.95 | 1.51 |
| 128² | 459 KB | 41 KB | 5.57 | 5.78 | 5.78 | 4.90 |
| 192² | 1069 KB | 91 KB | 13.60 | 14.69 | 14.69 | 13.12 |
| 256² | 1916 KB | 161 KB | 25.01 | 27.29 | 27.29 | 22.82 |

- The tick itself (paired `stepInPlace`) is now about 1 ms at every size, down from about 13 ms at 128² and 62 ms at 256²: walk grids are cached until the map changes, walking costs are lazy searches kept per start tile, a walk to a goal it can't reach fails from the map's open regions without a search, forage-patch shade is kept in state, and `idsOf` no longer sorts.
- What's left of `step` is the per-tick JSON copy: 83% at 128², 94% at 256². Ticket 14 moves the worker to `stepInPlace`, which drops it.
- Worst ticks without the copy (profiled at 128², `stepInPlace`): Dawn, about 16 ms, when every Carrier and gatherer looks for work at once; everything else under 10 ms. Before, the ticks over 50 ms shared failed A* searches (foragers trying patches walled in by trees, each search covering the whole reachable map) and whole-map Dijkstras per idle Carrier.
- `Create` went up from 334 to 529 ms at 256² (128²: 54 to 44 ms): `createInitialState` now works out every patch's shade, patches × trees, once.

## After in-place stepping and split snapshots (ticket 14)

Measured 2026-09-29, same machine and Node, `pnpm bench:maps 128`. The timed tick is now `stepInPlace`, as the worker runs it (no per-tick copy), so "Tick" here is what ADR-0004's `step` budget (mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms) now measures: 0.44 ms mean, 1.24 ms p95, 15.2 ms max. The paired columns still price `step`'s copy, which only tests pay now.

| Map | Entities | Trees | Forage patches | Villagers | Buildings | Road tiles | Create (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 128² | 5440 | 5191 | 118 | 50 | 44 | 96 | 67.39 |

| Map | Tick mean (ms) | Tick p95 | Tick max | Copy alone (ms) | Paired `step` (ms) | Paired `stepInPlace` (ms) | Copy share (paired) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 128² | 0.44 | 1.24 | 15.22 | 3.91 | 4.86 | 0.82 | 83% |

| Map | State (JSON) | Gzipped | Split (ms) | Join (ms) | Static-layer changes |
| --- | --- | --- | --- | --- | --- |
| 128² | 459 KB | 41 KB | 0.13 | 0.01 | 66 of 3600 ticks; layers in 66 of 1200 snapshots at 3× |

| Map | Snapshot part | Size (JSON) | Transfer mean (ms) | Transfer p95 | Transfer max | `structuredClone` (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| 128² | whole state (before) | 461 KB | 5.62 | 5.83 | 5.83 | 4.81 |
| 128² | moving part | 33 KB | 0.40 | 0.46 | 0.46 | 0.35 |
| 128² | static layers | 428 KB | 5.18 | 5.41 | 5.41 | 4.43 |

- The static layers are terrain, Roads, every map object and the map objects' tiles: 93% of the bytes. The moving part, posted every frame, is 33 KB and costs about 0.4 ms to post, down from 5.6 ms for the whole state.
- The layers still go out whenever a map object changes, and every chop changes a tree's `amount` (the renderer draws a part-chopped tree). In the benchmark's village that is 66 ticks of a day's 3600, so at 3× about one snapshot in 18 (roughly three a second at 60 fps) also carries the 428 KB of layers, about 5 ms on each thread. That is over the 4 ms main-thread budget on those frames: ticket 15 should measure it in the browser. If it shows, the cheapest cuts are separate versions for terrain+Roads (130 KB) and map objects with their tiles (300 KB), so a chop resends only the second, or sending only the map objects that changed.
- `movingPart` (the worker's split) is 0.13 ms and `joinSnapshot` (the main thread) 0.01 ms.

## After the renderer work (ticket 15)

Measured 2026-09-30, same machine, Chrome 154 headless (ANGLE Metal on the M1 Pro GPU, 1512×860 at 2× device pixels), driven over the DevTools protocol, with the page from `prototype/m4-map-size-page` redone on top of this ticket in a throwaway worktree (not committed: same synthetic map, same scripted five phases of 6 s after the map loads plus 4 s). Budget (ADR-0004, 128², 3× while panning and zooming): 60 fps, frame p95 ≤ 20 ms, main-thread snapshot handling ≤ 4 ms. Met: 60.0 fps in every phase, frame p95 19.0–19.7 ms, snapshot handling 0.9–1.1 ms mean, p95 ≤ 1.8 ms, worst 4.3 ms (one snapshot in 1650).

What changed: the static layers are redrawn only when they're new objects, and then only what changed (ground: a terrain compare; trees: a per-object diff); trees and forage patches are drawn a row run (one diagonal, 16 tiles) to a `Graphics` instead of one each; the ground in 16×16-tile chunks; everything off-screen is culled; `world` and `objects` are Pixi render groups; and after a game's first snapshot the worker sends a patch of what changed in the static layers instead of all 428 KB of them (135 B mean at 128²).

Columns as before, plus: `rAF p95` = p95 of the `requestAnimationFrame` timestamps' deltas (the frame's vsync), next to `p95` of `performance.now()` in the callback; `snapshot` = main-thread ms per snapshot, now including deserializing the message (timed on first access to `event.data`), joining and `Game.onSnapshot`; `with a patch` = snapshots that carried a static patch (before: the whole layers); `deserialize` split by those and the rest.

**128², 3×** (the budget)

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (patch) | deserialize (patch) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 19.2 | 21.3 | 16.7 | 0 | 1.7 | 5.4 | 1.1 | 1.5 | 4.3 | 5/330 | 2.9 | 0.3 | 0.3 | 0.7 |
| pan, zoom 0.6 | 60.0 | 16.7 | 19.5 | 24.3 | 16.8 | 0 | 1.0 | 6.0 | 1.1 | 1.8 | 2.3 | 6/330 | 1.8 | 0.2 | 0.3 | 1.0 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 19.7 | 23.6 | 16.7 | 0 | 1.9 | 5.6 | 0.9 | 1.4 | 2.0 | 9/330 | 1.4 | 0.3 | 0.3 | 0.7 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 19.0 | 24.3 | 16.7 | 0 | 0.8 | 5.9 | 1.1 | 1.8 | 2.2 | 11/330 | 1.4 | 0.3 | 0.3 | 1.0 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 19.7 | 22.2 | 16.7 | 0 | 0.9 | 4.9 | 1.0 | 1.6 | 2.2 | 11/330 | 1.5 | 0.3 | 0.3 | 1.6 |

**128², 1×**

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (patch) | deserialize (patch) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 19.4 | 23.5 | 16.7 | 0 | 0.6 | 3.8 | 1.1 | 1.9 | 3.3 | 2/110 | 2.8 | 0.3 | 0.2 | 2.3 |
| pan, zoom 0.6 | 60.0 | 16.7 | 19.4 | 22.4 | 16.8 | 0 | 0.6 | 3.0 | 1.2 | 1.8 | 2.4 | 2/110 | 2.1 | 0.3 | 0.3 | 2.0 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 18.8 | 22.4 | 16.8 | 0 | 2.0 | 4.7 | 1.1 | 1.5 | 1.9 | 1/110 | 1.9 | 0.3 | 0.3 | 0.9 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 19.0 | 24.7 | 16.8 | 0 | 0.7 | 3.4 | 1.3 | 1.9 | 3.9 | 3/110 | 3.3 | 0.4 | 0.3 | 1.3 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 19.5 | 21.1 | 16.8 | 0 | 1.3 | 4.4 | 1.3 | 1.9 | 3.0 | 0/110 | 0.0 | 0.0 | 0.4 | 0.9 |

**128², paused**

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (patch) | deserialize (patch) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 19.8 | 22.3 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 0.6 | 60.0 | 16.7 | 19.1 | 20.3 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 18.0 | 21.1 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 18.6 | 21.5 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 19.1 | 22.1 | 16.8 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |

**64², 3×**

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (patch) | deserialize (patch) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 20.5 | 22.0 | 16.8 | 0 | 1.3 | 6.1 | 0.9 | 1.6 | 2.3 | 7/330 | 1.6 | 0.2 | 0.3 | 0.9 |
| pan, zoom 0.6 | 60.0 | 16.7 | 20.3 | 22.8 | 16.7 | 0 | 1.4 | 6.1 | 1.1 | 1.6 | 2.8 | 12/329 | 1.6 | 0.3 | 0.3 | 0.8 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 19.9 | 21.6 | 16.8 | 0 | 1.9 | 7.4 | 1.0 | 1.5 | 2.3 | 11/330 | 1.3 | 0.3 | 0.3 | 0.8 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 19.3 | 22.3 | 16.8 | 0 | 1.0 | 3.8 | 1.0 | 1.7 | 2.8 | 12/329 | 1.2 | 0.3 | 0.3 | 0.7 |
| zooming 0.25–2.5 | 60.0 | 16.7 | 19.8 | 22.6 | 16.8 | 0 | 1.0 | 4.7 | 1.0 | 1.5 | 2.2 | 10/330 | 1.3 | 0.3 | 0.3 | 1.5 |

**Before this ticket, same session: 128², 3×** (commit `01e4a77`, static layers resent whole)

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (layers) | deserialize (layers) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 18.2 | 21.5 | 16.8 | 0 | 11.0 | 16.1 | 3.8 | 4.6 | 6.4 | 5/329 | 5.9 | 2.4 | 0.2 | 0.5 |
| pan, zoom 0.6 | 53.7 | 18.6 | 21.3 | 23.8 | 33.4 | 0 | 13.8 | 18.0 | 4.0 | 5.4 | 9.1 | 6/295 | 6.6 | 2.8 | 0.2 | 0.5 |
| pan, zoom 0.25 (out) | 54.3 | 18.4 | 21.8 | 26.2 | 33.3 | 0 | 13.7 | 19.4 | 4.0 | 6.1 | 11.0 | 9/299 | 7.1 | 2.5 | 0.2 | 0.4 |
| pan, zoom 1.5 (in) | 55.5 | 18.0 | 20.5 | 23.6 | 33.3 | 0 | 13.6 | 39.8 | 3.9 | 5.9 | 8.1 | 11/303 | 6.3 | 2.6 | 0.2 | 0.5 |
| zooming 0.25–2.5 | 54.9 | 18.2 | 20.8 | 28.3 | 33.3 | 0 | 12.9 | 17.5 | 4.1 | 5.8 | 8.7 | 11/301 | 6.6 | 2.5 | 0.2 | 1.0 |

**Before this ticket, same session: 128², paused**

| Phase | fps | Frame mean | p95 | Max | rAF p95 | Frames >33 ms | xfer mean | xfer max | snapshot mean | snapshot p95 | snapshot max | with a patch | snapshot (layers) | deserialize (layers) | deserialize (other) | worker mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| still, zoom 0.6 | 60.0 | 16.7 | 17.6 | 19.6 | 16.8 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 0.6 | 60.0 | 16.7 | 18.2 | 20.3 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 0.25 (out) | 60.0 | 16.7 | 18.1 | 31.0 | 16.8 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| pan, zoom 1.5 (in) | 60.0 | 16.7 | 17.8 | 21.6 | 16.7 | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |
| zooming 0.25–2.5 | 59.6 | 16.8 | 18.0 | 56.5 | 16.8 | 1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0/0 | 0.0 | 0.0 | 0.0 | 0.0 |

- **Frame rate.** 60 fps in every phase at 128² and 64², running or paused, and no frame over 33 ms. The rAF timestamps' p95 is one vsync (16.7–16.8 ms) everywhere, so no frame was dropped; before, at 3×, it was two (33.3 ms) while panning, with 54–56 fps.
- **Frame p95 (callback time).** 18.0–20.5 ms, against 17.4–18.2 ms before when paused. It's pacing noise in headless Chrome, not work: the main thread is 85% idle at 128² 3× (before: nearly all busy in Pixi's per-frame walk), and adding a busy loop of 8–12 ms to every frame brings the paused p95 down to 17.0–17.4 ms. The old renderer's heavy frames kept the callback on a steadier beat. A visible window on the owner's display wasn't available; there the p95 should sit nearer 16.7.
- **Snapshot handling.** About 1 ms a snapshot (0.3 ms of it deserializing the 33 KB moving part), down from about 4 ms (3.8–4.1 mean, worst 11 ms). A snapshot with a static patch costs 1.4–2.9 ms mean against 5.9–7.1 before, when the whole layers came along (2.4–2.8 ms of deserializing alone). Main-thread profile, 128² 3×: 85% idle; per frame about 1.3 ms (Pixi render, `drawWalkers`, culling), per snapshot about 1 ms (`syncStatics`, alerts, panels).
- **First sight of new ground.** Pixi builds a `Graphics`' geometry the first time it's drawn and frees it after a minute unused. Culled chunks and runs keep theirs, and new ones are drawn once before culling, so a pan never builds geometry mid-frame (it did in a first version: 36 ms frames).
- One frame of 193 ms in one run (with the snapshot transfer stalled the same 193 ms) had no main-thread work under it in the profile; it didn't recur.
- `pnpm bench:maps 128` now reports the patches: 66 of 3600 ticks change a static layer; a patch in 66 of 1200 snapshots at 3×, 135 B mean, 259 B max, 0.66 ms for the worker to work out (it compares terrain, Roads and every map object with the copy it keeps of what it sent). The static layers (428 KB, 5.3 ms transfer) now go only in a game's first snapshot.
- No visible change: screenshots of the paused synthetic maps at 64² and 128², six camera views each (zoom 0.25–2.5, centre and corners), match the old renderer but for 0–94 pixels of 960,000 at canopy outlines (sub-pixel differences from drawing trees through a transform). A game run at 3× for 40 s, then paused, draws the same trees, ground and buildings as the same save loaded fresh; only walking villagers differ (interpolation).

## Fog in the sim (ticket 16)

Measured 2026-09-30, same machine and Node, `pnpm bench:maps 128` and `pnpm bench:maps --fog 128`, back to back. Budget (ADR-0004, 128²): tick mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms. Met with Fog on: 0.48 ms mean, 1.26 ms p95, 14.9 ms max.

| 128² | Tick mean (ms) | Tick p95 | Tick max | Paired `step` (ms) | Paired `stepInPlace` (ms) | State (JSON) | Moving part | Static-layer changes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fog off | 0.45 | 1.25 | 15.33 | 4.89 | 0.81 | 461 KB | 33 KB | 66 of 3600 ticks, 151 B mean patch |
| Fog on | 0.48 | 1.26 | 14.87 | 5.33 | 1.20 | 462 KB | 34 KB | 66 of 3600 ticks, 151 B mean patch |

- The sight is worked out again only when a source changed tile or reach; a tick that doesn't still builds the key (about 100 sources), which is the ~0.03 ms. `step` (tests only) works it out every tick, since its copy has no remembered key: that's the paired columns' difference.
- The Revealed and In-sight tiles cost 2 KB each at 128² (512 numbers). The synthetic village stays inside the area Revealed at the start, so Fog adds no static-layer changes here; a Hero walking into the dark sends the Revealed tiles whole (2 KB) on each tick it Reveals something.

## Fog in the client (ticket 17)

Measured 2026-09-30, headless Chrome 154 over CDP (no visible window available), 1512×860, the synthetic 128² map loaded from a save with Fog on and again with it off, 3×, zoomed out so the Fog's edges are on screen, 12 s of panning. rAF intervals: 60.0 fps, mean 16.67 ms, p95 16.7–16.8 ms, max 16.8 ms, no frame over 33 ms, Fog on and off alike. Main thread about 80% idle either way; the Fog's own work (working out the field and uploading the texture when the Revealed or In-sight tiles change) came to 42 ms of the 12 s profile, about 0.06 ms a frame on average (`fogField` 33 ms of it).
