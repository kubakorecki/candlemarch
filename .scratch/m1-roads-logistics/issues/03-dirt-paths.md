# Dirt paths

Status: ready-for-agent
Type: task
Blocked by: 02

## What

The first kind of Road.

- State: path tiles per map tile (e.g. a per-tile road layer in `MapState`, or a component; implementer's choice, logged in `docs/decisions.md`).
- Content: a road type `dirt_path` with `speedPercent: 150`.
- Commands: `layPath {from, to}` and `removePath {from, to}`. Both use an L shape: horizontal leg from `from`, then vertical leg to `to`.
- Laying is all or nothing: if any tile of the L is invalid (not walkable/buildable, has a tree, footprint or stockpile), the whole command is ignored. Door tiles are allowed. Tiles already holding a path are fine.
- Removing clears path tiles in the L (and, once flags exist, their flags).
- Movement: a villager walking onto a path tile moves at `walkSpeed × speedPercent / 100` (integer).
- Paths are 4-connected. Expose a helper for "path neighbours of a tile" for later tickets.
- Export `canLayPath` so the client preview uses the same rule.

## Done when

- Headless tests: laying, invalid L ignored, removal, faster walking on a path, determinism.
- `pnpm check` passes.
