// Deposits: map objects holding a fixed amount of stone, clay or iron ore (`MapObjectDef.deposit`).
// What is dug out never comes back. Nothing works them until M5; they block walking like trees.
import type { Content, MapObjectId } from '@candlemarch/content';
import { isRiverbank, isWalkableTerrain, terrainAt } from './grid';
import type { EntityId, GameState, Tile } from './state';

/** Whether map object `id` is a Deposit. */
export function isDeposit(state: GameState, content: Content, id: EntityId): boolean {
  const obj = state.components.mapObject[id];
  return obj !== undefined && content.mapObjects[obj.type].deposit !== undefined;
}

/**
 * Whether a `type` map object may stand on `tile` by its Deposit rule: on its terrain, and at a
 * riverbank or a face when it asks for one. Always true for anything that isn't a Deposit, and
 * blind to what already stands there.
 */
export function depositFits(
  state: GameState,
  content: Content,
  type: MapObjectId,
  tile: Tile,
): boolean {
  const rule = content.mapObjects[type].deposit;
  if (!rule) return true;
  if (terrainAt(state.map, tile) !== rule.terrain) return false;
  if (rule.edge === 'riverbank') return isRiverbank(state, content, tile);
  if (rule.edge === 'face') {
    return orthogonal(tile).some((n) => isWalkableTerrain(state, content, n));
  }
  return true;
}

function orthogonal(tile: Tile): Tile[] {
  return [
    { x: tile.x, y: tile.y - 1 },
    { x: tile.x + 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x - 1, y: tile.y },
  ];
}
