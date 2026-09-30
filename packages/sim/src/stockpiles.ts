// Stockpiles: placing and removing them, and the goods on their tiles.
import type { Content, ResourceAmount, ResourceId } from '@candlemarch/content';
import { createEntity, destroyEntity } from './entities';
import { allRevealed } from './fog';
import {
  blockedGrid,
  doorTiles,
  inBounds,
  rectTiles,
  tileIndex,
  tilesUnderCaches,
  tilesUnderStockpiles,
} from './grid';
import type { EntityId, GameState, StockpileComponent, StockpilePriority } from './state';

/** Stockpile priorities, highest first. */
export const STOCKPILE_PRIORITIES: readonly StockpilePriority[] = ['high', 'normal', 'low'];

/**
 * Whether a stockpile can be placed on the w×h rectangle with its origin at (x, y): every tile
 * is on the map, buildable, and free of trees, building or site footprints, doors, roads,
 * caches and other stockpiles.
 */
export function canPlaceStockpile(
  state: GameState,
  content: Content,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const { map } = state;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return false;
  if (!inBounds(map, x, y) || !inBounds(map, x + w - 1, y + h - 1)) return false;
  const blocked = blockedGrid(state, content);
  const doors = doorTiles(state, content);
  const piles = tilesUnderStockpiles(state);
  const caches = tilesUnderCaches(state);
  const tiles = rectTiles({ x, y }, w, h);
  // Only on tiles the player has seen (Fog).
  if (!allRevealed(state, tiles)) return false;
  return tiles.every((t) => {
    const i = tileIndex(map, t.x, t.y);
    const terrain = map.terrain[i];
    return (
      terrain !== undefined &&
      content.terrain[terrain].buildable &&
      blocked[i] === 0 &&
      !doors.has(i) &&
      map.roads[i] === undefined &&
      !piles.has(i) &&
      !caches.has(i)
    );
  });
}

/** Creates a stockpile on the rectangle, or nothing if any tile of it is invalid. */
export function placeStockpile(
  state: GameState,
  content: Content,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!canPlaceStockpile(state, content, x, y, w, h)) return;
  const id = createEntity(state);
  state.components.tile[id] = { x, y };
  state.components.stockpile[id] = { size: { w, h }, priority: 'normal', refuses: [], goods: {} };
}

/** Removes a stockpile. Its goods are lost. Ignored if `id` isn't a stockpile. */
export function removeStockpile(state: GameState, id: EntityId): void {
  if (state.components.stockpile[id]) destroyEntity(state, id);
}

/** Whether `resource` is stored on Stockpiles at all. Food never is. */
export function isStockpileGood(content: Content, resource: ResourceId): boolean {
  return content.resources[resource]?.storage === 'stockpile';
}

/** Whether a stockpile takes more of `resource`: it's a stockpile good the pile doesn't refuse. */
export function stockpileTakes(
  content: Content,
  pile: StockpileComponent,
  resource: ResourceId,
): boolean {
  return isStockpileGood(content, resource) && !pile.refuses.includes(resource);
}

/** Units of `resource` on stockpile tile `index`. */
export function amountOnTile(
  pile: StockpileComponent,
  index: number,
  resource: ResourceId,
): number {
  const goods = pile.goods[index];
  return goods?.resource === resource ? goods.amount : 0;
}

/**
 * Units of `resource` stockpile tile `index` can still take: the capacity minus what's there,
 * or 0 if it holds another resource.
 */
export function roomOnTile(
  pile: StockpileComponent,
  index: number,
  resource: ResourceId,
  capacity: number,
): number {
  const goods = pile.goods[index];
  if (!goods) return capacity;
  return goods.resource === resource ? Math.max(0, capacity - goods.amount) : 0;
}

/** Takes up to `amount` of `resource` off stockpile tile `index`. Returns how many were taken. */
export function takeFromTile(
  pile: StockpileComponent,
  index: number,
  resource: ResourceId,
  amount: number,
): number {
  const taken = Math.min(amount, amountOnTile(pile, index, resource));
  const goods = pile.goods[index];
  if (!goods || taken <= 0) return 0;
  goods.amount -= taken;
  if (goods.amount === 0) delete pile.goods[index];
  return taken;
}

/**
 * Puts goods on stockpile tile `index` if it's empty or holds the same resource. Doesn't check
 * capacity. Returns false, changing nothing, if the tile holds another resource.
 */
export function addToTile(pile: StockpileComponent, index: number, goods: ResourceAmount): boolean {
  const here = pile.goods[index];
  if (!here) {
    pile.goods[index] = { ...goods };
    return true;
  }
  if (here.resource !== goods.resource) return false;
  here.amount += goods.amount;
  return true;
}
