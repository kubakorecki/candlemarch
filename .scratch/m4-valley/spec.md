# M4: The real valley

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

Replace hand-made maps with a procedurally generated valley, seeded with handcrafted points of interest, at a size the sim and renderer can handle. The forest becomes a living resource.

Done when a new game can start on a generated valley from a seed, the same seed always gives the same valley, performance stays within the budget, and forests regrow and can be overhunted.

## Scope

From `docs/spec.md` (World and map; Forest ecology):

- **Gate:** map-size prototype and performance budget (full-state snapshots and a JSON deep copy every tick may not scale).
- Terrain: meadow, forest, rock and mountain, river, swamp. Terrain gates expansion: a swamp needs draining, a snowed-in pass needs a road.
- Procedural valley + POI placement (ruins with loot, an abandoned mine, a roadside shrine, monster dens).
- Forest ecology: forester's lodge replants; young trees take about a year to mature; a forest tile is either logged or foraged; game population per forest region drops with hunting and recovers slowly.

## Waiting on

- **Map-size gate (ticket 02)** for generation and performance work.
- **Design session (ticket 03)** for the generator, POIs and ecology rules.
