# Benchmark the sim and renderer at map sizes

Status: resolved
Type: prototype
Blocked by: m2-camp-winter/04

## What

Facts for the map-size decision.

- A benchmark in `tooling/` that builds synthetic maps (e.g. 64², 128², 192², 256²) with a realistic entity load (trees, 50 villagers, buildings, roads) and measures: ms per `step`, share spent on the JSON deep copy, serialized state size, and worker→main snapshot transfer time.
- A throwaway client page that renders the largest map and reports frame time while panning and zooming.
- Write the numbers to `.scratch/m4-valley/benchmark.md`.

## Done when

- The report exists with numbers for every size. This ticket makes no decision.

## Comments

- 2026-09-28 — Report in `.scratch/m4-valley/benchmark.md` (sim, snapshot and page numbers at 64², 128², 192², 256²). Benchmark: `pnpm bench:maps` (`tooling/benchmark/`), on synthetic maps from `syntheticMap(size)`: a fixed 50-villager village (24 workers, 26 Carriers) with forest growing with the map, no Dens. The throwaway page is on branch `prototype/m4-map-size-page`, not on main (it patches the worker protocol, `SimBridge` and `Game`, and its worker imports `tooling/benchmark/syntheticMap`, which breaks the client import rule; fine for a throwaway, not for main); see the report's "Running it again". The owner's Chrome window was hidden, so page numbers come from a headless Chrome (real GPU) driven over the DevTools protocol; worth a look in a real window at the gate.
