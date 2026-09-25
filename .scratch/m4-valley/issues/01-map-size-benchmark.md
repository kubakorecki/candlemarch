# Benchmark the sim and renderer at map sizes

Status: ready-for-agent
Type: prototype
Blocked by: m2-camp-winter/04

## What

Facts for the map-size decision.

- A benchmark in `tooling/` that builds synthetic maps (e.g. 64², 128², 192², 256²) with a realistic entity load (trees, 50 villagers, buildings, roads) and measures: ms per `step`, share spent on the JSON deep copy, serialized state size, and worker→main snapshot transfer time.
- A throwaway client page that renders the largest map and reports frame time while panning and zooming.
- Write the numbers to `.scratch/m4-valley/benchmark.md`.

## Done when

- The report exists with numbers for every size. This ticket makes no decision.
