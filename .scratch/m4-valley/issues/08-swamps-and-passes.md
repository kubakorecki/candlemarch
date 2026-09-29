# Drains, the Pass road and the Hero in the snow

Status: ready-for-agent
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
