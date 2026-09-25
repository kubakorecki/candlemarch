# Stockpiles (logs)

Status: ready-for-agent
Type: task
Blocked by: 02

## What

An open-air patch of land where goods are stored (see `CONTEXT.md`).

- Command `placeStockpile {x, y, w, h}` creates one Stockpile entity from a rectangle. Every tile must be buildable and free of trees, buildings, doors, paths and other stockpiles; otherwise the command is ignored. No merging.
- Command `removeStockpile {id}`; its goods are lost.
- Each tile holds **one resource**, up to `stockpileTileCapacity` from content (start: 8). An empty tile takes whatever arrives first.
- Stockpile tiles are walkable; buildings and paths can't be placed on them (update `canPlaceBuilding`).
- `listSupplies` includes stockpiles. `listDemands` includes stockpiles **after** every construction site. A stockpile never supplies another stockpile.
- Job dispatch: carriers walk onto the stockpile tile they deliver to or pick up from: the nearest tile with room, or the nearest tile holding the resource, ties by tile index.
- Export `canPlaceStockpile` for the client preview.

## Done when

- Headless tests: placement rules, per-tile capacity and one-resource rule, woodcutter → stockpile flow, stockpile → site flow, sites before stockpiles, no stockpile-to-stockpile hauling, removal.
- Determinism and save/load tests cover a game with a stockpile.
- `pnpm check` passes.
