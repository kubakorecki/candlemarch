# Fog lives in the sim

Status: accepted (2026-09-29)

The Valley is hidden under Fog: a tile is unrevealed, Revealed (seen once) or In sight (seen now). Fog decides where the player may build (only on Revealed tiles), so it's game logic, and `CLAUDE.md` keeps game logic out of the client. So the sim owns it. State holds a Revealed flag per tile, which is saved. The sim works out the In-sight tiles from the Hero, villagers, buildings, manned watchtowers and Light, and sends both to the client. Fog changes only what the player knows and where they may build. Gloamlings, Dens and villagers act exactly as if it weren't there, so combat, pathfinding and every balance scenario stay independent of it.

## Considered options

- **Client-only Fog**, purely visual. Rejected: the client would have to enforce "no building on unrevealed tiles", or players could build blind. Revealed tiles would also have to be kept outside the save.
- **Fog that changes behaviour** (Gloamlings hiding in it, villagers avoiding it). Rejected: every system would depend on what the player has seen, and balance runs would need to fake a player's eyes.

## Consequences

- A per-game Fog setting (like the Monster rate) switches it off. Off means every tile counts as Revealed and In sight. It defaults to off on hand-made maps, so tests and scenarios don't change.
- Revealed flags are a per-tile static layer. Under ADR-0004 they go to the client only when they change. In-sight tiles change every tick, so their cost falls under the sim budget.
- Commands to build on unrevealed tiles are rejected by the sim, like any other illegal placement.
