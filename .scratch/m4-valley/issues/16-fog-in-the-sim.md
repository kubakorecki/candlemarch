# Fog in the sim

Status: ready-for-agent
Type: task
Blocked by: none

## What

Rules in `docs/spec.md`, World and map ("Fog"), and `docs/adr/0005-fog-lives-in-the-sim.md`. Numbers Proposed, all in content.

- **Setting:** `fog` on or off per game, in state, set at New game and changed by a dev command, like the Monster rate. It defaults to off for hand-made maps, so every existing test and scenario is unchanged. Off means every tile counts as Revealed and In sight. Switching it on again keeps what's Revealed.
- **Revealed:** a per-tile flag in state, compact enough for 128² saves. At the start, everything within 12 tiles of the Camp is Revealed, plus the entry. A tile In sight becomes Revealed for good.
- **In sight:** worked out by the sim from sight sources (Chebyshev tiles, day / night):

  | Source | Day | Night |
  | --- | --- | --- |
  | Hero | 8 | 4 |
  | Villager | 4 | 2 |
  | Finished building | 3 | 1 |
  | Watchtower with its Watchman | 8 | 8 |
  | Light | — | its lit tiles |

  Only recompute when something could change it (a source crossing a tile, Dusk, Dawn, a building finished or removed), so it stays inside the sim budget.
- **The build rule:** placing a building, Road, Drain, Pass road or Reserve on an unrevealed tile is rejected, like any illegal placement. The Hero can still be ordered to any tile.
- **Nothing else changes:** Gloamlings, Dens and villagers act as if Fog weren't there.
- The Revealed tiles are a static layer (ticket 14, if it has landed; otherwise part of the snapshot). The In-sight tiles go with the moving part. The client (ticket 17) only draws them.

## Done when

- Headless tests:
  - sight radii by day and by night;
  - Revealed tiles stay Revealed;
  - building on an unrevealed tile is refused, and allowed once Revealed;
  - Fog off makes every tile Revealed and In sight;
  - switching Fog back on keeps what's Revealed;
  - a night scenario gives the same deaths with Fog on as with it off;
  - save/load keeps Revealed tiles.
- The sim budget still holds at 128² with Fog on.
- `pnpm check` passes.
