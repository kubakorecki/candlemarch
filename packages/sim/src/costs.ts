// What a building costs to build: its content `construction.cost`, or its `cheaperAt` cost when
// its footprint touches that point of interest (a mine at the Abandoned mine). Worked out from
// where it stands, so nothing is stored on the site.
import type { BuildingId, Content, ResourceAmount } from '@candlemarch/content';
import { footprint } from './grid';
import type { EntityId, GameState, Rotation, Tile } from './state';

/**
 * The cost of a `type` building turned `rotation` with its origin at `origin`: `cheaperAt.cost`
 * when a footprint tile is within 1 tile (Chebyshev) of a point of interest of that kind, else
 * `construction.cost`. Empty for a building that can't be built.
 */
export function constructionCost(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): ResourceAmount[] {
  const def = content.buildings[type];
  const cost = def.construction?.cost ?? [];
  const cheaper = def.cheaperAt;
  if (!cheaper) return cost;
  const body = footprint(def, origin, rotation);
  for (const id of Object.keys(state.components.poi).map(Number)) {
    const at = state.components.tile[id];
    if (!at || state.components.poi[id]?.kind !== cheaper.poi) continue;
    if (body.some((t) => Math.abs(t.x - at.x) <= 1 && Math.abs(t.y - at.y) <= 1)) {
      return cheaper.cost;
    }
  }
  return cost;
}

/** What construction site `id` needs delivered in all (`constructionCost` where it stands). */
export function siteCost(state: GameState, content: Content, id: EntityId): ResourceAmount[] {
  const site = state.components.site[id];
  const origin = state.components.tile[id];
  if (!site || !origin) return [];
  return constructionCost(state, content, site.type, origin, site.rotation);
}
