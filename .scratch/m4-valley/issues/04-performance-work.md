# Sim performance: the code that scales badly with the map

Status: resolved
Type: task
Blocked by: 02

## What

The sim's share of the budget in `docs/adr/0004-valley-size-and-budget.md`. Where the time goes is in `.scratch/m4-valley/benchmark.md` ("Where tick time goes").

- **Forage-patch shade.** `isWithered` checks every patch against every map object, and foragers call it for every patch when looking for work. Keep each patch's shade in state instead, updated only when a tree near it is felled, planted or matures. The client reads that flag rather than working it out (ticket 15 relies on this).
- **Map-wide flood fills.** `travelCosts` (Dijkstra over the whole map) runs for each idle Carrier every `idleRetryTicks`, plus homes and Granary lookups, and rebuilds the walk grid (`blockedGrid`, `speedPercentGrid`) on every call. Cache the walk grid until the map changes, and stop searches early once the answer is known (nearest target found, or a cost bound).
- **`idsOf`** sorts store keys on every call (about 10% at 64²). Make ID-ordered iteration cheaper without breaking the "iterate in ID order" rule.
- **Worst ticks.** Profile the ticks over 50 ms (272 ms at 128² today) and fix what they share.
- Nothing may change behaviour: same seed, same commands, same state as before.

## Done when

- `pnpm bench:maps 128` meets the sim budget: `step` mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms. The new numbers are appended to `.scratch/m4-valley/benchmark.md`.
- Determinism and save/load tests pass, and the balance scenarios give the same results as before.
- `pnpm check` passes.

## Comments

2026-09-29 — Rewritten after gate 02: this ticket is now the sim's share only. In-place stepping in the worker and split snapshots are ticket 14; the renderer is ticket 15.

2026-09-29 — Done. Derived map data (blocked/speed/walk/Gloamling/lit grids, open regions, walking-cost searches) is cached off each state object in `sim/src/mapCache.ts` until a new `state.mapVersion` counter moves on (`mapChanged`); `step` hands the cache to its copy. Walking costs are lazy, exact Dijkstra searches (`costSearch`), kept per start tile, so an idle Carrier re-dispatching each tick costs next to nothing. A walk that can't reach its goal fails from 4-connected regions (`canReach`) without an A* search: that was what the worst ticks shared (foragers trying walled-in patches every 20 ticks, everyone at Dawn). Forage patches keep `withered` on the map object (`refreshShade`, called by `fellTree`; old saves work it out on load). `idsOf` no longer sorts. Same state tick for tick as before in every balance scenario and in synthetic 64² and 96² runs (hashes compared every 300 ticks, `step` and `stepInPlace`). Numbers appended to `benchmark.md`. The copy in `step` is now about 80% of a tick at 128²: ticket 14's in-place stepping is where the rest goes.
