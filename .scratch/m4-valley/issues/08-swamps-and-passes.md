# Drains, the Pass road and the Hero in the snow

Status: resolved
Type: task
Blocked by: 05

## What

Rules in `docs/spec.md`, World and map ("Terrain"). Numbers Proposed, all in content.

- **Drain:** laid over Swamp tiles the way a Road is laid: one construction site per tile, 2 logs, 200 build ticks, built by day like any site. When finished, the tile becomes Meadow for good.
- **Pass road:** laid over Pass snow the way a Road is laid: 6 logs, 600 build ticks per tile. A finished tile is walkable by everyone, all year. Dirt paths can't be laid on Pass snow.
- **The Hero wades Pass snow** at 30% speed. Villagers and Gloamlings can't.
- Client: Drain and Pass road tools, placement previews, placeholder art for a site and a finished tile.

## Done when

- Headless tests: a Drain turns Swamp into buildable Meadow; a Pass road opens the Pass to villagers and Gloamlings, tile by tile; a Dirt path is refused on Pass snow; the Hero crosses Pass snow slowly while a villager can't.
- `pnpm check` passes.

## Comments

2026-09-30 — Done. `drain` and `pass_road` are 1×1 buildings with a `groundwork` def, laid with `layGroundwork` (all or nothing over the L; Revealed tiles of their terrain only) and built from ordinary sites that block nobody; a finished site goes and writes Meadow or the `pass_road` Road (100%, Proposed). Carriers supply a Pass road site from the walkable tile beside it, so it builds tile by tile from the reachable end; a Road over unwalkable terrain opens it to villagers and Gloamlings. The Hero wades Pass snow at 30% (`heroSpeedPercent` in content, its own walk grid). Client: Drain (U) and Pass road (J) drag tools in Roads & Storage with ghosts, site art (ditch / logs growing), a log-ribbed Pass road. Beyond the issue: Remove path now leaves Pass roads alone. Not seen in a browser: no map has Swamp or Pass snow until the generator (06). See `docs/decisions.md`.
