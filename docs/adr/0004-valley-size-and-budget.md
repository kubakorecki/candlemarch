# The Valley is 128² tiles, held to a fixed performance budget

Status: accepted (2026-09-29)

The map-size benchmark (`.scratch/m4-valley/benchmark.md`) showed 64² inside every reference point, and 128² right at the limit: `step` averages 16.5 ms against 3×'s 16.7 ms, and each snapshot costs the main thread about 21 ms. From 192² up, the sim, the renderer and the snapshots are all far over. We picked **128²**. A Town of 50 residents fills roughly 40 × 40 tiles, and 64² would leave too little wild land for Dens, POIs, a Side valley and forests worth managing. The 128² overrun comes from code that scales badly, not from the architecture: forage-patch shade checks every patch against every tree, a whole-map Dijkstra runs per idle Carrier, the client revisits every object on every snapshot, and nothing off-screen is culled. The per-tick JSON copy is only 9–16% of a tick.

## Budget

Measured with `pnpm bench:maps` on the reference machine (Apple M1 Pro) at 128², with the benchmark's 50-villager village:

- **Sim:** `step` mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms (so even 1× never hitches).
- **Client**, running at 3× while panning and zooming: 60 fps, frame p95 ≤ 20 ms, main-thread snapshot handling ≤ 4 ms.

The headroom against 3×'s 16.7 ms is on purpose: M5–M7 add systems, and players will have slower machines than the reference one.

## How we meet it

- Fix the code that scales badly (see above).
- The worker steps its own state in place (`stepInPlace`). `step()` keeps copying, so tests can still hold old states.
- Snapshots are split into a **moving part** (villagers, Gloamlings, stocks), sent every frame, and **static layers** (terrain, trees, roads, Fog), sent only when a version counter the sim bumps has changed.

## Considered options

- **64²:** already inside budget, but too small for a Town plus the wilds around it.
- **192² or larger:** would need deeper changes: no per-tile state in JSON, spatial indexes everywhere, and a chunked renderer.
- **Keep full snapshots:** at 128² a structured clone costs about 5 ms on each thread, up to 60 times a second.
- **General state diffs:** more machinery than we need, because the static layers are most of the bytes.

## Consequences

- The Valley's size is a content number. Moving it later means re-running the benchmark against this budget.
- Tickets `m4-valley/04`, `14` and `15` use this budget as their "Done when".
- Each later milestone's playtest should re-run `pnpm bench:maps`.
