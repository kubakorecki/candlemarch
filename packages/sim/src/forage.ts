// Forage patches (berry bushes, mushroom patches): map objects that refill each season while a
// tree shades them. Whether a patch has withered is kept on it (`withered`), updated only when
// the trees near it change, so nothing scans the map for shade each tick.
import type { Content } from '@candlemarch/content';
import type { EntityId, GameState, Tile } from './state';

/** Whether map object `id` is a forage patch. */
export function isForagePatch(state: GameState, content: Content, id: EntityId): boolean {
  const obj = state.components.mapObject[id];
  return obj !== undefined && content.mapObjects[obj.type].forage !== undefined;
}

/**
 * Whether forage patch `id` has withered: no standing `shadedBy` object (a tree) within
 * `shadeTiles`, Chebyshev distance (a square around it). A withered patch yields nothing and
 * doesn't refill. False for anything that isn't a forage patch.
 */
export function isWithered(state: GameState, _content: Content, id: EntityId): boolean {
  return state.components.mapObject[id]?.withered === true;
}

/** Works out from where things stand whether forage patch `id` has withered (see `isWithered`). */
function hasNoShade(state: GameState, content: Content, id: EntityId): boolean {
  const { mapObject, tile } = state.components;
  const obj = mapObject[id];
  const at = tile[id];
  const forage = obj ? content.mapObjects[obj.type].forage : undefined;
  if (!forage || !at) return false;
  for (const key in mapObject) {
    const other = mapObject[Number(key)];
    const t = tile[Number(key)];
    if (other?.type !== forage.shadedBy || !t) continue;
    if (Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y)) <= forage.shadeTiles) return false;
  }
  return true;
}

/**
 * Sets `withered` on every forage patch whose shade `near` could change (within its
 * `shadeTiles`), or on every patch without `near`. Call it after a tree near patches is felled,
 * planted or grows up.
 */
export function refreshShade(state: GameState, content: Content, near?: Tile): void {
  const { mapObject, tile } = state.components;
  for (const key in mapObject) {
    const id = Number(key);
    const obj = mapObject[id];
    const forage = obj ? content.mapObjects[obj.type].forage : undefined;
    const at = tile[id];
    if (!obj || !forage || !at) continue;
    if (near && Math.max(Math.abs(near.x - at.x), Math.abs(near.y - at.y)) > forage.shadeTiles) {
      continue;
    }
    obj.withered = hasNoShade(state, content, id);
  }
}

/** Whether a forager can gather from `id` now: a forage patch with stock that hasn't withered. */
export function canForage(state: GameState, content: Content, id: EntityId): boolean {
  return (
    isForagePatch(state, content, id) &&
    (state.components.mapObject[id]?.amount ?? 0) > 0 &&
    !isWithered(state, content, id)
  );
}
