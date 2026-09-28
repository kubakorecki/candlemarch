// Palisades and Gates (spec, Nights in v1): 1×1 wall segments, laid by dragging like a Road and
// built from ordinary construction sites. What they block is in `grid.ts` (`blockedGrid`); a wall
// Gloamlings have battered to 0 HP blocks nobody until it heals at Dawn.
import type { BuildingId, Content } from '@candlemarch/content';
import { createEntity } from './entities';
import { canPlaceBuilding, inBounds, tileIndex } from './grid';
import { lShapeTiles } from './roads';
import type { EntityId, GameState, Tile } from './state';

/** Whether `type` is a wall segment: a palisade or a Gate. */
export function isWallType(content: Content, type: BuildingId): boolean {
  return content.buildings[type].wall !== undefined;
}

/**
 * Full HP of a `type` building Gloamlings batter: a wall's (`WallDef.hp`) or a House's door
 * (`houseDoorHp`). Null for buildings they don't batter.
 */
export function fullHp(content: Content, type: BuildingId): number | null {
  const def = content.buildings[type];
  if (def.wall) return def.wall.hp;
  return def.residents ? content.combat.houseDoorHp : null;
}

/** Whether building `id` is a wall segment battered down to 0 HP (it heals at Dawn). */
export function isBrokenWall(state: GameState, content: Content, id: EntityId): boolean {
  const b = state.components.building[id];
  return b !== undefined && isWallType(content, b.type) && b.hp === 0;
}

/** Whether building or site `id` is a wall segment, built or not. */
export function isWall(state: GameState, content: Content, id: EntityId): boolean {
  const type = state.components.building[id]?.type ?? state.components.site[id]?.type;
  return type !== undefined && isWallType(content, type);
}

/** Tile indices holding a wall segment or a wall's site, of any kind. */
function wallTiles(state: GameState, content: Content): Set<number> {
  const tiles = new Set<number>();
  for (const [key, t] of Object.entries(state.components.tile)) {
    if (isWall(state, content, Number(key))) tiles.add(tileIndex(state.map, t.x, t.y));
  }
  return tiles;
}

/**
 * The tiles of the L from `from` to `to` that would get a new `type` site, in walking order:
 * every tile but those already holding a wall (built or a site). Null if `type` isn't a wall,
 * an end is off the map, any other tile can't take one (`canPlaceBuilding`), or no tile would.
 */
function wallLine(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): Tile[] | null {
  if (!content.buildings[type] || !isWallType(content, type)) return null;
  if (![from, to].every((t) => inBounds(state.map, t.x, t.y))) return null;
  const walls = wallTiles(state, content);
  const line = lShapeTiles(from, to).filter((t) => !walls.has(tileIndex(state.map, t.x, t.y)));
  if (line.length === 0) return null;
  return line.every((t) => canPlaceBuilding(state, content, type, t.x, t.y)) ? line : null;
}

/** Whether a `type` wall can be laid along the L from `from` to `to` now (`wallLine`). */
export function canLayWall(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): boolean {
  return wallLine(state, content, type, from, to) !== null;
}

/**
 * Lays a `type` wall (palisade or Gate) along the L from `from` to `to`: a construction site on
 * each tile that doesn't hold one yet, in walking order. Nothing if any of them can't take one.
 */
export function layWall(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): void {
  const line = wallLine(state, content, type, from, to);
  if (!line) return;
  for (const t of line) {
    const id = createEntity(state);
    state.components.tile[id] = { x: t.x, y: t.y };
    state.components.site[id] = { type, rotation: 0, delivered: {}, buildProgress: 0 };
  }
}
