# Gate: pick the map size and performance budget

Status: resolved
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

## Comments

2026-09-29 — Decided in a `/grill-with-docs` session together with ticket 03, from the benchmark report (the owner didn't try the page in a real window). The Valley is 128², a content number. Budget, at 128² on the M1 Pro: `step` mean ≤ 5 ms, p95 ≤ 10 ms, no tick over 50 ms; the client runs 60 fps at 3× while panning, frame p95 ≤ 20 ms, main-thread snapshot handling ≤ 4 ms. The worker steps in place, and snapshots split into a moving part and static layers sent only when changed; no general diffs. Recorded in `docs/adr/0004-valley-size-and-budget.md`; the spec's "Map size?" is closed. Ticket 04 is rewritten as the sim's share, and the snapshot and renderer work are split out as tickets 14 and 15.
