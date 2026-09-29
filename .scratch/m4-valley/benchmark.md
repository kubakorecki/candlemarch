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
