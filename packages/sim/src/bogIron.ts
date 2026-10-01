// Bog iron (spec, Resources: Renewing what runs out): every tile of a terrain with a content `ore`
// def (Swamp) holds up to `cap` iron ore. What has been dug since the last spring is
// `map.oreDug`, by tile index; at the first Dawn of spring it all comes back (`refillOre`, from
// the renewal system). A Drained tile is Meadow, which holds none, so its ore is lost for good.
// The bog-iron digger's worker digs it (`systems/digging.ts`).
import type { BuildingId, Content } from '@candlemarch/content';
import { buildingLayout, inBounds, tileIndex } from './grid';
import { groundworkOf, groundworkTiles } from './groundwork';
import type { EntityId, GameState, Rotation, Tile } from './state';

/** The most ore `tile` can hold: its terrain's `ore.cap`, or 0 off the map or without one. */
export function oreCap(state: GameState, content: Content, tile: Tile): number {
  const { map } = state;
  if (!inBounds(map, tile.x, tile.y)) return 0;
  const terrain = map.terrain[tileIndex(map, tile.x, tile.y)];
  return terrain === undefined ? 0 : (content.terrain[terrain].ore?.cap ?? 0);
}

/** The ore `tile` holds now: its cap less what has been dug from it since the last spring. */
export function oreAt(state: GameState, content: Content, tile: Tile): number {
  const cap = oreCap(state, content, tile);
  if (cap === 0) return 0;
  const dug = state.map.oreDug[tileIndex(state.map, tile.x, tile.y)] ?? 0;
  return Math.max(0, cap - dug);
}

/** Takes `amount` ore from `tile` (no more than it holds). */
export function digOre(state: GameState, tile: Tile, amount: number): void {
  const i = tileIndex(state.map, tile.x, tile.y);
  state.map.oreDug[i] = (state.map.oreDug[i] ?? 0) + amount;
}

/** Every tile's ore back up to its cap (spring). */
export function refillOre(state: GameState): void {
  if (Object.keys(state.map.oreDug).length > 0) state.map.oreDug = {};
}

/**
 * The tiles of terrain `type` digs ore from (`digsOre`) within its work radius of a body at
 * `origin` turned `rotation`, row by row. Empty for a building that digs none.
 */
function reachedTiles(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation,
): Tile[] {
  const def = content.buildings[type];
  const terrain = def.digsOre;
  if (!terrain) return [];
  const body = buildingLayout(def, origin, rotation);
  const r = def.workRadius ?? 0;
  const { map } = state;
  const tiles: Tile[] = [];
  for (let y = body.origin.y - r; y < body.origin.y + body.size.h + r; y++) {
    for (let x = body.origin.x - r; x < body.origin.x + body.size.w + r; x++) {
      if (inBounds(map, x, y) && map.terrain[tileIndex(map, x, y)] === terrain) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** The tiles building `id` could dig ore from now (some left), in its radius, row by row. */
export function oreTargets(state: GameState, content: Content, id: EntityId): Tile[] {
  const b = state.components.building[id];
  const origin = state.components.tile[id];
  if (!b || !origin) return [];
  return reachedTiles(state, content, b.type, origin, b.rotation).filter(
    (t) => oreAt(state, content, t) > 0,
  );
}

/** The ore a `type` building at `origin` would reach now: its placement preview. */
export function bogIronNear(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): number {
  return reachedTiles(state, content, type, origin, rotation).reduce(
    (n, t) => n + oreAt(state, content, t),
    0,
  );
}

/**
 * The ore `type` groundwork laid along the L from `from` to `to` would lose for good: what the
 * tiles that would get a site hold now, when it turns them into terrain without ore (a Drain).
 * 0 when it can't be laid there.
 */
export function bogIronLost(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): number {
  const becomes = groundworkOf(content, type)?.becomes;
  if (!becomes || !('terrain' in becomes) || content.terrain[becomes.terrain].ore) return 0;
  const line = groundworkTiles(state, content, type, from, to) ?? [];
  return line.reduce((n, t) => n + oreAt(state, content, t), 0);
}
