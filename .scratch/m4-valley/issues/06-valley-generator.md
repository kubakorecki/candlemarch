# Procedural valley generator

Status: resolved
Type: task
Blocked by: 02, 03, 05, 11

## What

Rules in `docs/spec.md`, World and map ("The Valley", "Forest ecology"). Every number goes in a content `valley` definition; the size is 128.

- `generateValley(seed, content)` in `sim` produces a `MapDef`-like layout from the seeded PRNG only:
  - a Mountain rim with one entry gap and the entry tile;
  - one river edge to edge, off-centre, with 2–3 Fords;
  - the Pass through the rim (Pass snow) into a Side valley;
  - Forest in noise-shaped patches, with Forage patches in it;
  - Swamp beside the river's slow bends and Rock at the foot of the Mountains;
  - Deposits: 5 stone, 4 clay, 2 iron (both iron in the Side valley);
  - 3 Dens: each at least 40 tiles from the Camp, at least one in the Side valley;
  - the Starting Camp within 10 tiles of the entry.
- **Hunting grounds:** each connected stretch of Forest becomes a ground, split so none exceeds 250 tiles, named from a content list, with max Game 1 per 10 trees. (The tile-set shape comes from ticket 11.)
- **Guarantees** near the Camp: 24 × 24 buildable Meadow without Swamp; 150+ trees within 15 tiles, forming a Hunting ground; 6+ Forage patches within 20; a Riverbank within 20; a Ford within 30; a stone and a clay Deposit within 30; no Den within 40; the Side valley reachable once the Pass is open. If one fails, retry with a seed derived from the first.
- `createInitialState` can start from a generated Valley.
- `pnpm bench:maps` can run on a generated Valley as well as the synthetic maps.

POIs other than Dens come in ticket 07; Fog in ticket 16.

## Done when

- Headless tests: the same seed gives an identical Valley; the guarantees and counts hold across 100 seeds; every walkable tile of the main valley is reachable from the entry; generation at 128² takes under 1 s in Node.
- `pnpm bench:maps` reports a generated Valley. Its numbers are appended to `.scratch/m4-valley/benchmark.md`, for comparison with the synthetic map.
- `pnpm check` passes.

## Comments

2026-09-30 — Done. `generateValley(seed, content)` in `sim/src/valley/` returns a `Valley`: a `MapDef` (`createInitialState` builds it as it is) plus `layoutSeed`, `camp`, `sideValley` and `pass` tile indices for ticket 07. Numbers in `content.valley` (`ValleyDef`). Hand-made maps may now give Hunting grounds as tile sets too. `pnpm bench:maps valley[:seed]` runs a generated Valley; numbers in `benchmark.md`. Tests: `sim/test/valley.test.ts` (same seed → same Valley; shape, counts, guarantees, reach and grounds over seeds 1–100; the sim's own regions on one seed), `tooling/benchmark/valley.test.ts` (under 1 s; about 15 ms). Beyond the issue: the layout is turned or mirrored (one of 8) so the entry can be on any edge; the generator also guarantees every Forage patch and Deposit has a reachable side tile; a forest stretch under 20 tiles holds no ground. Not checked: the spec's 2–4 Swamp patches (attempted; blobs may touch). Decisions in docs/decisions.md.
