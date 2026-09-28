// Monster Dens and the Monster rate: the rules other modules ask about, and clearing a Den. The
// nightly work (spawns, budding, Gloamlings vanishing) is `systems/dens.ts`; the Hero's hits and
// the Den's sting are `systems/combat.ts`.
import type { Content, ResourceId } from '@candlemarch/content';
import { createEntity, destroyEntity, idsOf } from './entities';
import type { DenComponent, EntityId, GameState, Tile } from './state';

/** A Den as it stands on the map or buds: full HP, ready to sting. */
export function newDen(content: Content): DenComponent {
  return { hp: content.combat.den.hp, readyAt: 0 };
}

/**
 * Clears Den `id` (its HP is gone): it's removed, its cache (`dens.cleared.cache`) is left on its
 * tile, and a calm area starts there. Gloamlings it sent out tonight stay out until Dawn.
 */
export function clearDen(state: GameState, content: Content, id: EntityId): void {
  const at = state.components.tile[id];
  if (!state.components.den[id] || !at) return;
  destroyEntity(state, id);
  const { cache, calmDays } = content.dens.cleared;
  const pile = createEntity(state);
  state.components.tile[pile] = { x: at.x, y: at.y };
  state.components.cache[pile] = {
    stock: Object.fromEntries(cache.map(({ resource, amount }) => [resource, amount])),
  };
  state.calms.push({
    tile: { x: at.x, y: at.y },
    until: state.tick + calmDays * content.calendar.dayTicks,
  });
}

/** The Den on `tile`, if any. */
export function denAt(state: GameState, tile: Tile): EntityId | null {
  for (const id of idsOf(state.components.den)) {
    const t = state.components.tile[id];
    if (t && t.x === tile.x && t.y === tile.y) return id;
  }
  return null;
}

/** The cache on `tile`, if any. */
export function cacheAt(state: GameState, tile: Tile): EntityId | null {
  for (const id of idsOf(state.components.cache)) {
    const t = state.components.tile[id];
    if (t && t.x === tile.x && t.y === tile.y) return id;
  }
  return null;
}

/**
 * Takes up to `amount` of `resource` from cache `id`; returns how many were taken. The cache is
 * gone once it holds nothing.
 */
export function takeFromCache(
  state: GameState,
  id: EntityId,
  resource: ResourceId,
  amount: number,
): number {
  const cache = state.components.cache[id];
  if (!cache) return 0;
  const taken = Math.max(0, Math.min(amount, cache.stock[resource] ?? 0));
  const left = (cache.stock[resource] ?? 0) - taken;
  if (left > 0) cache.stock[resource] = left;
  else delete cache.stock[resource];
  if (Object.keys(cache.stock).length === 0) destroyEntity(state, id);
  return taken;
}

/** Whether `tile` is within `calmTiles` (Chebyshev) of a Den cleared in the last `calmDays`. */
export function inCalmArea(state: GameState, content: Content, tile: Tile): boolean {
  const reach = content.dens.cleared.calmTiles;
  return state.calms.some(
    ({ tile: c, until }) =>
      state.tick < until && Math.abs(c.x - tile.x) <= reach && Math.abs(c.y - tile.y) <= reach,
  );
}

/** Whether `rate` is a valid Monster rate: a whole number from 0 to 100. */
export function isMonsterRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isInteger(rate) && rate >= 0 && rate <= 100;
}

/** Tiles of every Den, in ID order. */
export function denTiles(state: GameState): Tile[] {
  const { den, tile } = state.components;
  const tiles: Tile[] = [];
  for (const id of idsOf(den)) {
    const t = tile[id];
    if (t) tiles.push(t);
  }
  return tiles;
}

/** Whether `tile` is in a Den's dark ring (Chebyshev distance), where nothing can be built. */
export function inDarkRing(state: GameState, content: Content, tile: Tile): boolean {
  const ring = content.dens.darkRingTiles;
  return denTiles(state).some(
    (d) => Math.abs(d.x - tile.x) <= ring && Math.abs(d.y - tile.y) <= ring,
  );
}

/** Every map tile in a Den's dark ring, row by row. For the placement preview. */
export function darkRingTiles(state: GameState, content: Content): Tile[] {
  const dens = denTiles(state);
  if (dens.length === 0) return [];
  const result: Tile[] = [];
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (inDarkRing(state, content, { x, y })) result.push({ x, y });
    }
  }
  return result;
}
