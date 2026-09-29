# Terrain types and Deposits

Status: ready-for-agent
Type: task
Blocked by: 03

## What

Rules in `docs/spec.md`, World and map ("Terrain", "Deposits"). Numbers Proposed, all in content.

- **Terrain:** `meadow` (renames `grass`; `normalizeLoadedState` maps old saves), `rock`, `mountain`, `swamp`, `river`, `ford`, `pass_snow`. Each `TerrainDef` gains a walking speed:

  | Terrain | Walkable | Buildable | Speed |
  | --- | --- | --- | --- |
  | meadow | yes | yes | 100% |
  | rock | yes | no | 80% |
  | mountain | no | no | — |
  | swamp | yes | no | 50% |
  | river | no | no | — |
  | ford | yes | no | 50% |
  | pass_snow | no | no | — |

  A Road's speed replaces the terrain's on its tile. Gloamlings walk by the same rules. (The quarry's exception for Rock comes in M5; the Hero wading `pass_snow` comes in ticket 08.)
- **Deposits:** resources `stone`, `clay` and `iron_ore` (Stockpile goods), and map objects `stone_deposit` (on Rock), `clay_deposit` (on a Riverbank) and `iron_deposit` (on a Mountain tile next to walkable ground). They reuse the generic map-object fields. Amounts are placeholders that M5 tunes; nothing works them yet.
- Map legend characters for every terrain and Deposit on hand-made maps. Existing maps stay valid.
- Client: placeholder art for each terrain and Deposit, in the palette module. Fords read as shallow water; Pass snow reads as impassable.

## Done when

- Map and pathfinding tests cover each terrain: walkability, buildability, speed, a Road on a slow tile, a Gloamling crossing a Ford.
- The content validation test checks each Deposit's resource and the terrain it may stand on.
- A save with `grass` loads as `meadow`.
- `pnpm check` passes.

## Comments

2026-09-29 — Design session 03: Forest stays "Meadow tiles with trees", not a terrain. Fords and Pass snow were added in the session, and Deposits moved here from `m5-hamlet/06` so the generator (06) can place them.
