# Monster dens, night spawns and the Monster rate

Status: ready-for-agent
Type: task
Blocked by: 01, m2-camp-winter/02

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Dens, Monster rate). Numbers Proposed, all in content.

- A Den map object, placed by maps (legend character; the generator places them in M4).
- At each Dusk a Den spawns Gloamlings on its tile by season: spring 1, summer 2, autumn 3, winter 4, times the Monster rate (`trunc(n × rate ÷ 100)`). At Dawn every Gloamling still out vanishes.
- Gloamlings are entities that exist and stand still in this ticket; ticket 04 makes them move and fight.
- **Budding:** once a season, each Den buds a new Den 6–10 tiles closer to the nearest building, on a tile at least 12 tiles from any building, with at most 5 Dens on the map. Picks among candidate tiles with the seeded PRNG. (Ticket 06 adds "on a dark tile".)
- **Dark ring:** nothing can be built within 6 tiles of a Den (Chebyshev), checked in `fitsAt` so maps can't cheat it either. Client placement preview shows the ring.
- **Monster rate:** a per-game setting in state, 0–100, default 100; old saves load as 100. `createInitialState` takes it; the dev New-game panel gets an on/off toggle; a dev command changes it mid-game. At 0: no spawns, no budding, and Gloamlings out vanish at once.
- Existing maps have no Dens, so every existing test and balance run is unchanged.
- Client: Den and Gloamling placeholder art (palette colours).

## Done when

- Headless tests: spawns only at Dusk and by season; all vanish at Dawn; budding moves toward the village and respects the cap and distances; no building fits in the dark ring; rate 0 stops spawns and budding and clears live Gloamlings; determinism and save/load mid-night.
- `pnpm check` passes.
