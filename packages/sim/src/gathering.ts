// Gatherers (woodcutters, foragers): what their Workplace's output buffer has room for, how far
// they may go, and walking to the nearest map object worth gathering.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import { blockedGrid, standingTiles, tileIndex } from './grid';
import { tileDistance } from './pathfinding';
import type { EntityId, GameState, Tile } from './state';
import { villagerTile, walkTo } from './systems/movement';

/** Units of `resource` building `id`'s output buffer still has room for; 0 without a slot for it. */
export function outputRoom(
  state: GameState,
  content: Content,
  id: EntityId,
  resource: ResourceId,
): number {
  const b = state.components.building[id];
  const slot = b && content.buildings[b.type].outputBuffer?.find((s) => s.resource === resource);
  if (!b || !slot) return 0;
  return Math.max(0, slot.capacity - (b.stock[resource] ?? 0));
}

/**
 * Whether `tile` is within building `id`'s work radius: at most `workRadius` tiles from its
 * footprint, Chebyshev distance. Always true for a building without one.
 */
export function inWorkRadius(
  state: GameState,
  content: Content,
  id: EntityId,
  tile: Tile,
): boolean {
  const b = state.components.building[id];
  const origin = state.components.tile[id];
  if (!b || !origin) return false;
  const { size, workRadius } = content.buildings[b.type];
  if (workRadius === undefined) return true;
  const dx = Math.max(0, origin.x - tile.x, tile.x - (origin.x + size.w - 1));
  const dy = Math.max(0, origin.y - tile.y, tile.y - (origin.y + size.h - 1));
  return Math.max(dx, dy) <= workRadius;
}

/**
 * Map objects the workers of building `hutId` could gather from now, in ID order: of a type it
 * gathers, `canGather`, within its work radius, and yielding something its output buffer has room
 * for.
 */
export function gatherTargets(
  state: GameState,
  content: Content,
  hutId: EntityId,
  canGather: (id: EntityId) => boolean,
): EntityId[] {
  const { mapObject, tile, building } = state.components;
  const hut = building[hutId];
  const gathers = hut ? (content.buildings[hut.type].gathers ?? []) : [];
  return idsOf(mapObject).filter((t) => {
    const obj = mapObject[t];
    if (!obj || !gathers.includes(obj.type) || !canGather(t)) return false;
    const resource = content.mapObjects[obj.type].resource;
    return (
      inWorkRadius(state, content, hutId, tile[t] as Tile) &&
      outputRoom(state, content, hutId, resource) > 0
    );
  });
}

/**
 * Starts villager `id` walking to the nearest of map objects `targets` it can reach (walking
 * distance from where it stands, ties by ID), to stand next to it. Returns that object, or null.
 */
export function walkToNearest(
  state: GameState,
  content: Content,
  id: EntityId,
  targets: EntityId[],
): EntityId | null {
  const here = villagerTile(state, id);
  if (!here) return null;
  const { map } = state;
  const hereIndex = tileIndex(map, here.x, here.y);
  const candidates = targets
    .map((t) => {
      const at = state.components.tile[t] as Tile;
      return {
        id: t,
        at,
        distance: tileDistance(map.width, hereIndex, tileIndex(map, at.x, at.y)),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.id - b.id);

  const blocked = blockedGrid(state, content);
  for (const c of candidates) {
    if (walkTo(state, content, id, standingTiles(state, blocked, c.at))) return c.id;
  }
  return null;
}
