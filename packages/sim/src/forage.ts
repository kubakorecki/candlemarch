// Forage patches (berry bushes, mushroom patches): map objects that refill each season while a
// tree shades them. Withered (no shade) is derived from where things stand; nothing is stored.
import type { Content } from '@candlemarch/content';
import type { EntityId, GameState } from './state';

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
export function isWithered(state: GameState, content: Content, id: EntityId): boolean {
  const { mapObject, tile } = state.components;
  const obj = mapObject[id];
  const at = tile[id];
  const forage = obj ? content.mapObjects[obj.type].forage : undefined;
  if (!forage || !at) return false;
  for (const [key, other] of Object.entries(mapObject)) {
    const t = tile[Number(key)];
    if (other.type !== forage.shadedBy || !t) continue;
    if (Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y)) <= forage.shadeTiles) return false;
  }
  return true;
}

/** Whether a forager can gather from `id` now: a forage patch with stock that hasn't withered. */
export function canForage(state: GameState, content: Content, id: EntityId): boolean {
  return (
    isForagePatch(state, content, id) &&
    (state.components.mapObject[id]?.amount ?? 0) > 0 &&
    !isWithered(state, content, id)
  );
}
