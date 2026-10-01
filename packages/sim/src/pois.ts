// Points of interest (spec, World and map: "Points of interest"): Ruins the Hero Searches once
// for a Cache, the Abandoned mine (a mine beside it costs less: `costs.ts`) and the Shrine, near which no Den buds. The
// Hero's Search order is `hero.ts`; where the Valley puts them is `valley/layout.ts`.
import type { Content } from '@candlemarch/content';
import { leaveCache } from './dens';
import { idsOf } from './entities';
import { randomInt } from './rng';
import type { EntityId, GameState, Tile } from './state';

/** The point of interest on `tile`, if any. */
export function poiAt(state: GameState, tile: Tile): EntityId | null {
  for (const id of idsOf(state.components.poi)) {
    const t = state.components.tile[id];
    if (t && t.x === tile.x && t.y === tile.y) return id;
  }
  return null;
}

/** Tile indices of every point of interest. Nothing is built or buds on them. */
export function tilesUnderPois(state: GameState): Set<number> {
  const tiles = new Set<number>();
  for (const id of idsOf(state.components.poi)) {
    const t = state.components.tile[id];
    if (t) tiles.add(t.y * state.map.width + t.x);
  }
  return tiles;
}

/** Whether `id` is a point of interest the Hero can still Search: Ruins not yet Searched. */
export function isSearchable(state: GameState, content: Content, id: EntityId): boolean {
  const poi = state.components.poi[id];
  return poi !== undefined && !poi.searched && content.pois[poi.kind].search !== undefined;
}

/**
 * Finishes the Search of `id`: it's Searched for good and leaves a Cache on its tile, each amount
 * of its `search.cache` ± `spreadPercent` (rounded down), rolled with the PRNG now.
 */
export function finishSearch(state: GameState, content: Content, id: EntityId): void {
  const poi = state.components.poi[id];
  const at = state.components.tile[id];
  const search = poi ? content.pois[poi.kind].search : undefined;
  if (!poi || !at || !search) return;
  poi.searched = true;
  const stock = search.cache.map(({ resource, amount }) => {
    const spread = Math.floor((amount * search.spreadPercent) / 100);
    return { resource, amount: amount - spread + randomInt(state, 2 * spread + 1) };
  });
  leaveCache(state, at, stock);
}

/** Whether `tile` is within a Shrine's `wardTiles` (Chebyshev), where no Den buds. */
export function inWard(state: GameState, content: Content, tile: Tile): boolean {
  for (const id of idsOf(state.components.poi)) {
    const poi = state.components.poi[id];
    const t = state.components.tile[id];
    const ward = poi ? content.pois[poi.kind].wardTiles : undefined;
    if (ward === undefined || !t) continue;
    if (Math.abs(t.x - tile.x) <= ward && Math.abs(t.y - tile.y) <= ward) return true;
  }
  return false;
}
