# Gate: pick the map size and performance budget

Status: ready-for-human
Type: prototype
Blocked by: 01

## What

The owner reads the benchmark, tries the prototype page, and decides:

- Valley size (tiles per side).
- Performance budget (ms per tick at 3×, frame time target).
- Whether the full-state deep copy and full snapshots must go (they were logged as "revisit if profiling on big maps shows the copy matters").

Record as an ADR (hard to reverse, real trade-off), update the spec's open question, and rewrite ticket 04 if performance work is needed.

## Done when

- ADR written; the spec's "Map size?" question is closed.
