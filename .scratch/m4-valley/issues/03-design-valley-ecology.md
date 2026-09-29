# Design session: valley generation, POIs and ecology

Status: resolved
Type: grilling
Blocked by: 02

## What

A `/grill-with-docs` session for the M4 rules. Record answers in `docs/spec.md` and `CONTEXT.md`, then promote or rewrite the `needs-info` tickets that list this one.

## Questions

1. **Valley shape:** mountains around the edge? one river through the middle? where the Camp starts and what it's guaranteed nearby (forest, river, rock)?
2. **Terrain rules:** walkability, buildability and speed for meadow, forest, rock, mountain, swamp. Are trees always on forest tiles, or is "forest" just tiles with trees?
3. **Swamp draining:** who drains, what it costs, what the tile becomes.
4. **Snowed-in pass:** where passes are, which seasons they close, what a road changes.
5. **Resource placement:** stone, clay and iron ore deposits: sizes, counts, distance from the start.
6. **POIs:** the 4–5 types, what each holds (loot, a trapped master for M6's rescue invitations, a shrine's effect), and how many per valley.
7. **Logged vs foraged:** how a forest tile becomes one or the other (a player-painted reserve, or whatever happened last)?
8. **Game regions:** how forest regions are defined, population numbers, recovery rate, "empty for seasons".
9. **Regrowth:** do forests regrow on their own, or only with a forester?

## Done when

- Every question has an answer in the spec, and the dependent tickets are updated.

## Comments

2026-09-29 — Answers are in `docs/spec.md`, World and map (Terrain, The Valley, Deposits, Points of interest, Fog, Forest ecology), plus new terms in `CONTEXT.md`. Beyond the listed questions, the session added **Fog** (three states, lives in the sim: `docs/adr/0005-fog-lives-in-the-sim.md`), **Fords** (the river would otherwise cut every Valley in two; bridges go to M6), Stumps that regrow, and a Hero who wades the snowed-in Pass. Tickets 04–12 are rewritten and promoted; 14–18 are new. Parked for M5: what happens when a Deposit runs out (spec Open questions).
