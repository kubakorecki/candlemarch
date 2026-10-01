// Marks (spec, World and map, "Forest ecology"): the woodcutter's hut panel's Fell and Dig stumps
// tools. The player paints a rectangle and every tree (Fell) or Stump (Dig) on it is marked. A
// woodcutter fells marked trees in its radius before any other, and digs out marked Stumps, which
// nothing else does. A mark is a flag on the map object (`mapObject.marked`), so it travels to the
// client with the map objects' static layer and leaves with the object.
import type { Content, MapObjectId } from '@candlemarch/content';
import { idsOf } from './entities';
import { canPaintReserve, inReserve, paintReserve } from './reserves';
import { staticChanged } from './snapshot';
import type { EntityId, GameState, Tile } from './state';

/** What a mark asks for: a tree felled, or a Stump dug out. */
export type MarkKind = 'fell' | 'dig';

/** The mark a map object of `type` takes: `fell` for a standing tree, `dig` for one a building digs. */
export function markKindOf(content: Content, type: MapObjectId): MarkKind | null {
  if (type === content.hunting.forest) return 'fell';
  const dug = Object.values(content.buildings).some((b) => b.digs?.includes(type));
  return dug ? 'dig' : null;
}

/** Whether map object `id` is marked. */
export function isMarked(state: GameState, id: EntityId): boolean {
  return state.components.mapObject[id]?.marked === true;
}

/**
 * Whether marks may be painted on the rectangle with corners `from` and `to`: the same as a
 * Reserve (both corners on the map, every tile Revealed).
 */
export function canMark(state: GameState, from: Tile, to: Tile): boolean {
  return canPaintReserve(state, from, to);
}

/** Map objects on the rectangle with corners `a` and `b`, in ID order. */
function objectsIn(state: GameState, a: Tile, b: Tile): EntityId[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const { tile } = state.components;
  return idsOf(state.components.mapObject).filter((id) => {
    const at = tile[id];
    return at !== undefined && at.x >= x0 && at.x <= x1 && at.y >= y0 && at.y <= y1;
  });
}

/**
 * Marks every map object taking `kind` on the rectangle with corners `from` and `to` (the
 * `markTrees`/`markStumps` commands), or nothing if it can't be painted (`canMark`). A tree in a
 * Reserve is left unmarked: Keep wins.
 */
export function markObjects(
  state: GameState,
  content: Content,
  kind: MarkKind,
  from: Tile,
  to: Tile,
): void {
  if (!canMark(state, from, to)) return;
  const { mapObject, tile } = state.components;
  let changed = false;
  for (const id of objectsIn(state, from, to)) {
    const obj = mapObject[id];
    if (!obj || obj.marked || markKindOf(content, obj.type) !== kind) continue;
    if (kind === 'fell' && inReserve(state, tile[id] as Tile)) continue;
    obj.marked = true;
    changed = true;
  }
  if (changed) staticChanged(state);
}

/**
 * Takes the marks off the map objects on the rectangle with corners `from` and `to` (the
 * `clearMarks` command); with `kind`, only those of that kind. Fog doesn't matter.
 */
export function clearMarks(
  state: GameState,
  content: Content,
  from: Tile,
  to: Tile,
  kind?: MarkKind,
): void {
  const { mapObject } = state.components;
  let changed = false;
  for (const id of objectsIn(state, from, to)) {
    const obj = mapObject[id];
    if (!obj?.marked) continue;
    if (kind !== undefined && markKindOf(content, obj.type) !== kind) continue;
    delete obj.marked;
    changed = true;
  }
  if (changed) staticChanged(state);
}

/**
 * Paints the rectangle with corners `from` and `to` as a Reserve (the `paintReserve` command) and
 * takes the Fell marks off the trees now in it, so no tree is both kept and marked.
 */
export function paintKeep(state: GameState, content: Content, from: Tile, to: Tile): void {
  if (!canPaintReserve(state, from, to)) return;
  paintReserve(state, from, to);
  clearMarks(state, content, from, to, 'fell');
}
