// Tile maths, footprints, walkability and building placement.
import type { BuildingDef, BuildingId, Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { type GameState, type MapState, type Point, TILE_UNITS, type Tile } from './state';

export function inBounds(map: MapState, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height
  );
}

export function tileIndex(map: MapState, x: number, y: number): number {
  return y * map.width + x;
}

export function tileAt(map: MapState, index: number): Tile {
  return { x: index % map.width, y: Math.floor(index / map.width) };
}

export function tileCenter(tile: Tile): Point {
  return { x: tile.x * TILE_UNITS + TILE_UNITS / 2, y: tile.y * TILE_UNITS + TILE_UNITS / 2 };
}

export function tileOfPoint(point: Point): Tile {
  return { x: Math.floor(point.x / TILE_UNITS), y: Math.floor(point.y / TILE_UNITS) };
}

/** Tiles covered by a building placed with its origin at `origin`. */
export function footprint(def: BuildingDef, origin: Tile): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      tiles.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }
  return tiles;
}

export function doorTile(def: BuildingDef, origin: Tile): Tile {
  return { x: origin.x + def.door.x, y: origin.y + def.door.y };
}

/** Door tile of a building or construction site entity. */
export function entityDoor(state: GameState, content: Content, id: number): Tile | null {
  const type = state.components.building[id]?.type ?? state.components.site[id]?.type;
  const origin = state.components.tile[id];
  if (type === undefined || origin === undefined) return null;
  return doorTile(content.buildings[type], origin);
}

/** Every building and construction site with its type and origin, in ID order. */
function structures(state: GameState): { type: BuildingId; origin: Tile }[] {
  const { building, site, tile } = state.components;
  const result: { type: BuildingId; origin: Tile }[] = [];
  for (const id of idsOf(tile)) {
    const type = building[id]?.type ?? site[id]?.type;
    const origin = tile[id];
    if (type !== undefined && origin !== undefined) result.push({ type, origin });
  }
  return result;
}

/**
 * Walk-blocking grid: 1 where a villager can't walk. Terrain that isn't walkable, map objects
 * (trees) and building/site footprints block. Built fresh on each call; maps are small.
 */
export function blockedGrid(state: GameState, content: Content): Uint8Array {
  const { map } = state;
  const blocked = new Uint8Array(map.width * map.height);
  map.terrain.forEach((terrain, i) => {
    if (!content.terrain[terrain].walkable) blocked[i] = 1;
  });
  for (const id of idsOf(state.components.mapObject)) {
    const t = state.components.tile[id];
    if (t) blocked[tileIndex(map, t.x, t.y)] = 1;
  }
  for (const s of structures(state)) {
    for (const t of footprint(content.buildings[s.type], s.origin)) {
      if (inBounds(map, t.x, t.y)) blocked[tileIndex(map, t.x, t.y)] = 1;
    }
  }
  return blocked;
}

/**
 * Whether a building of this type fits with its origin at (x, y): every footprint tile is in
 * bounds, buildable, and free of trees, roads, other footprints and other doors; its door tile
 * is in bounds, walkable and not blocked (it may be on a road). Doesn't check whether the player may place this type.
 */
export function fitsAt(
  state: GameState,
  content: Content,
  type: BuildingId,
  x: number,
  y: number,
): boolean {
  const { map } = state;
  const def = content.buildings[type];
  if (!inBounds(map, x, y)) return false;
  const blocked = blockedGrid(state, content);

  const doors = new Set<number>();
  for (const s of structures(state)) {
    const d = doorTile(content.buildings[s.type], s.origin);
    if (inBounds(map, d.x, d.y)) doors.add(tileIndex(map, d.x, d.y));
  }

  for (const t of footprint(def, { x, y })) {
    if (!inBounds(map, t.x, t.y)) return false;
    const i = tileIndex(map, t.x, t.y);
    const terrain = map.terrain[i];
    if (terrain === undefined || !content.terrain[terrain].buildable) return false;
    if (blocked[i] === 1 || doors.has(i) || map.roads[i] !== undefined) return false;
  }

  const door = doorTile(def, { x, y });
  if (!inBounds(map, door.x, door.y)) return false;
  return blocked[tileIndex(map, door.x, door.y)] === 0;
}

/** Whether the player may place a building of this type at (x, y) right now. */
export function canPlaceBuilding(
  state: GameState,
  content: Content,
  type: BuildingId,
  x: number,
  y: number,
): boolean {
  const def = content.buildings[type];
  if (!def?.placeable || !def.construction) return false;
  return fitsAt(state, content, type, x, y);
}
