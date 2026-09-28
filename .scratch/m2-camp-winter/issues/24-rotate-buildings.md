# Rotate buildings when placing them

Status: resolved
Type: task
Blocked by: none

## What

Buildings can't rotate: each always has its door on the side content gives it, south for every building today. That costs placement options. The fisher's hut (ticket 09) needs its door on a riverbank, so an east–west river can only be fished from its north bank, and a 2×2 fisher's hut would fit only one bank of any straight river (see `docs/decisions.md`, 2026-09-27). The clay pit and watermill will hit the same wall. Rotation also lets the player turn doors towards a road.

The spec doesn't mention rotation, so this adds to it.

All views for each orientation for existing buildings should be implemented in this issue.

### Rule

- Four orientations: the content layout (door where content puts it), then quarter turns clockwise. Stored as `rotation: 0 | 1 | 2 | 3` on buildings and construction sites.
- Content still defines `size` and `door` for rotation 0. One sim function turns a type, an origin and a rotation into the footprint and door tile. `footprint`, `doorTile`, `entityDoor`, `fitsAt`, `blockedGrid` and everything else that reads `def.size` or `def.door` for a placed building go through it. A quarter turn swaps `w` and `h`. The origin stays the footprint's smallest x and y.
- `placeBuilding` gains an optional `rotation` (default 0), so existing command streams, tests and maps behave as before. Map definitions can give `rotation` for buildings and sites. Saves without it load as 0, with no `STATE_VERSION` bump.
- Placement rules are checked on the rotated layout, including `doorOnRiverbank`.

### Client

- A key turns the placement preview a quarter turn clockwise (`R` is already the path tool, so pick another, e.g. `Q`/`E` for either direction). The preview shows where the door will be.
- Rotated buildings draw with the swapped footprint. A door on a back face (north or west, hidden in the isometric view) shows as a mark on its door tile instead.
- The chopping block's custom drawing turns too, or at least keeps its piles beside the door.

## Done when

- **Headless tests:**
  - Footprint and door for each of the four rotations of a 2×2 and a 1×1 building.
  - A fisher's hut placed with its door facing north fits the south bank of an east–west river.
  - Walkers path around the rotated footprint, and carriers deliver to the rotated door of a site.
  - Omitted rotation means 0; invalid values are ignored like any bad command.
  - Determinism, save/load with rotated buildings, and an old save without `rotation` loads.
  - every existing building has 4 rotation options. It differs visually in all 4 rotations.
- The rotation rule is added to `docs/spec.md` and logged in `docs/decisions.md`.
- `pnpm check` passes.

## Comments

- 2026-09-28 — Done. `rotation` on buildings and sites, `buildingLayout` in `sim/src/grid.ts`, optional `rotation` on `placeBuilding` and map buildings/sites, saves backfill 0. Client: `E`/`Q` turn the preview; back-wall doors draw as a doorstep plus a small door over the building; sites show the doorstep; the chopping block's chips, piles and axe follow its door. Tests: `sim/test/rotation.test.ts` (layouts, riverbank, commands, pathing, carriers, determinism, save/load, old saves) and `client/test/rotation.test.ts` (each building's door is on a different face in all four rotations). No content building is non-square, so the swapped-footprint tests use a test `Content` with a 3×1 Granary.
