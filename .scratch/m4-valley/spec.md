# M4: The real valley

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

Replace hand-made maps with a procedurally generated Valley, seeded with handcrafted points of interest and hidden under Fog, at a size the sim and renderer can handle. The forest becomes a living resource.

Done when:
- a new game can start on a generated Valley from a seed, and the same seed always gives the same Valley;
- performance stays within the budget of ADR-0004;
- Fog hides what hasn't been seen;
- forests regrow and can be overhunted.

## Scope

From `docs/spec.md` (World and map: Size, Terrain, The Valley, Deposits, Points of interest, Fog, Forest ecology):

- **Gate (done):** a 128² Valley and a performance budget (`docs/adr/0004-valley-size-and-budget.md`). Sim hot spots (04), in-place stepping and split snapshots (14), renderer (15).
- Terrain: meadow, rock, mountain, swamp, river, ford, Pass snow; Deposits placed for M5 (05). Drains and the Pass road (08).
- Procedural Valley (06) with POIs: Ruins, Abandoned mine, Shrine, Dens, and the Hero's Search (07).
- Fog, living in the sim (`docs/adr/0005-fog-lives-in-the-sim.md`): sim (16), client (17).
- Forest ecology: forester and Saplings (09), Reserves (10), Hunting grounds as tile sets with Game recovery (11), Stumps (18).
- New game on a generated Valley (12), playtest (13).

## Waiting on

Nothing: gate 02 and design session 03 are resolved.
