// Tile maths, footprints, walkability and building placement.
import type { BuildingDef, BuildingId, Content, TerrainId } from '@candlemarch/content';
import { inDarkRing } from './dens';
import { idsOf } from './entities';
import {
  type EntityId,
  type GameState,
  isRotation,
  type MapState,
  type Point,
  type Rotation,
  TILE_UNITS,
  type Tile,
} from './state';

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

/** Tiles of the w×h rectangle with its origin at `origin`, row by row (ascending tile index). */
export function rectTiles(origin: Tile, w: number, h: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }
  return tiles;
}

/** The terrain of `tile`, or undefined off the map. */
export function terrainAt(map: MapState, tile: Tile): TerrainId | undefined {
  return inBounds(map, tile.x, tile.y) ? map.terrain[tileIndex(map, tile.x, tile.y)] : undefined;
}

/** Whether `tile` is on the map and its terrain can be walked on, whatever stands there. */
export function isWalkableTerrain(state: GameState, content: Content, tile: Tile): boolean {
  const terrain = terrainAt(state.map, tile);
  return terrain !== undefined && content.terrain[terrain].walkable;
}

/**
 * Whether `tile` is riverbank: walkable terrain orthogonally next to a river tile. Trees or
 * buildings standing on it don't change that.
 */
export function isRiverbank(state: GameState, content: Content, tile: Tile): boolean {
  if (!isWalkableTerrain(state, content, tile)) return false;
  return [
    { x: tile.x, y: tile.y - 1 },
    { x: tile.x + 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x - 1, y: tile.y },
  ].some((n) => terrainAt(state.map, n) === 'river');
}

/** Where a placed building stands: its size and tiles, and the tile in front of its door. */
export interface BuildingLayout {
  /** Smallest x and y of the footprint. */
  origin: Tile;
  /** Size in tiles after turning: a quarter turn swaps `w` and `h`. */
  size: { w: number; h: number };
  /** Footprint tiles, row by row. */
  tiles: Tile[];
  door: Tile;
}

/**
 * The layout of a `def` building with its origin at `origin`, turned `rotation` quarter turns
 * clockwise from the content layout. Every rule that reads a placed building's size or door goes
 * through here.
 */
export function buildingLayout(
  def: BuildingDef,
  origin: Tile,
  rotation: Rotation = 0,
): BuildingLayout {
  let { w, h } = def.size;
  let door = { x: def.door.x, y: def.door.y };
  for (let turn = 0; turn < rotation; turn++) {
    // Clockwise with y pointing south: the w×h box becomes h×w and (x, y) goes to (h−1−y, x).
    door = { x: h - 1 - door.y, y: door.x };
    [w, h] = [h, w];
  }
  return {
    origin: { x: origin.x, y: origin.y },
    size: { w, h },
    tiles: rectTiles(origin, w, h),
    door: { x: origin.x + door.x, y: origin.y + door.y },
  };
}

/** Tiles covered by a building placed with its origin at `origin`. */
export function footprint(def: BuildingDef, origin: Tile, rotation: Rotation = 0): Tile[] {
  return buildingLayout(def, origin, rotation).tiles;
}

export function doorTile(def: BuildingDef, origin: Tile, rotation: Rotation = 0): Tile {
  return buildingLayout(def, origin, rotation).door;
}

/** Layout of a building or construction site entity, or null if `id` is neither. */
export function entityLayout(
  state: GameState,
  content: Content,
  id: EntityId,
): BuildingLayout | null {
  const placed = state.components.building[id] ?? state.components.site[id];
  const origin = state.components.tile[id];
  if (placed === undefined || origin === undefined) return null;
  return buildingLayout(content.buildings[placed.type], origin, placed.rotation);
}

/** Door tile of a building or construction site entity. */
export function entityDoor(state: GameState, content: Content, id: number): Tile | null {
  return entityLayout(state, content, id)?.door ?? null;
}

/** Layouts of every building and construction site, in ID order. */
function structures(state: GameState, content: Content): BuildingLayout[] {
  const result: BuildingLayout[] = [];
  for (const id of idsOf(state.components.tile)) {
    const layout = entityLayout(state, content, id);
    if (layout) result.push(layout);
  }
  return result;
}

/**
 * Whether building or site `id` blocks walking: every footprint does, but a wall's site blocks
 * nobody until it's built, and a built Gate blocks only Gloamlings (`gatesBlock`).
 */
function blocksWalking(
  state: GameState,
  content: Content,
  id: EntityId,
  gatesBlock: boolean,
): boolean {
  const { building, site } = state.components;
  const type = building[id]?.type ?? site[id]?.type;
  if (type === undefined) return false;
  const wall = content.buildings[type].wall;
  if (!wall) return true;
  const built = building[id];
  if (!built || built.hp === 0) return false; // battered down until Dawn
  return !wall.gate || gatesBlock;
}

/**
 * Walk-blocking grid: 1 where a villager or the Hero can't walk. Terrain that isn't walkable, map
 * objects (trees) and building/site footprints block, but not a wall's site, a built Gate or a
 * wall battered down to 0 HP. `gatesBlock` makes Gates block too, for Gloamlings. Built fresh on each call; maps are small.
 */
export function blockedGrid(state: GameState, content: Content, gatesBlock = false): Uint8Array {
  const { map } = state;
  const blocked = new Uint8Array(map.width * map.height);
  map.terrain.forEach((terrain, i) => {
    if (!content.terrain[terrain].walkable) blocked[i] = 1;
  });
  for (const id of idsOf(state.components.mapObject)) {
    const t = state.components.tile[id];
    if (t) blocked[tileIndex(map, t.x, t.y)] = 1;
  }
  for (const id of idsOf(state.components.tile)) {
    if (!blocksWalking(state, content, id, gatesBlock)) continue;
    for (const t of entityLayout(state, content, id)?.tiles ?? []) {
      if (inBounds(map, t.x, t.y)) blocked[tileIndex(map, t.x, t.y)] = 1;
    }
  }
  return blocked;
}

/**
 * Tile indices of every palisade segment, built or a site: no Road goes over one. (A Gate may
 * stand on a Road.)
 */
export function palisadeTiles(state: GameState, content: Content): Set<number> {
  const { map } = state;
  const { building, site } = state.components;
  const tiles = new Set<number>();
  for (const id of idsOf(state.components.tile)) {
    const type = building[id]?.type ?? site[id]?.type;
    const wall = type === undefined ? undefined : content.buildings[type].wall;
    if (!wall || wall.gate) continue;
    for (const t of entityLayout(state, content, id)?.tiles ?? []) {
      if (inBounds(map, t.x, t.y)) tiles.add(tileIndex(map, t.x, t.y));
    }
  }
  return tiles;
}

/** Walkable tiles around `tile` (8 directions), where a gatherer can stand. */
export function standingTiles(state: GameState, blocked: Uint8Array, tile: Tile): Tile[] {
  const result: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = tile.x + dx;
      const y = tile.y + dy;
      if (inBounds(state.map, x, y) && blocked[tileIndex(state.map, x, y)] === 0) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

/** Tile indices of every building and site door on the map. */
export function doorTiles(state: GameState, content: Content): Set<number> {
  const { map } = state;
  const doors = new Set<number>();
  for (const { door: d } of structures(state, content)) {
    if (inBounds(map, d.x, d.y)) doors.add(tileIndex(map, d.x, d.y));
  }
  return doors;
}

/** Map tile indices of a stockpile's tiles, ascending. Empty if `id` isn't a stockpile. */
export function stockpileTileIndices(state: GameState, id: EntityId): number[] {
  const pile = state.components.stockpile[id];
  const origin = state.components.tile[id];
  if (!pile || !origin) return [];
  return rectTiles(origin, pile.size.w, pile.size.h).map((t) => tileIndex(state.map, t.x, t.y));
}

/** Tile indices covered by any stockpile. */
export function tilesUnderStockpiles(state: GameState): Set<number> {
  const tiles = new Set<number>();
  for (const id of idsOf(state.components.stockpile)) {
    for (const i of stockpileTileIndices(state, id)) tiles.add(i);
  }
  return tiles;
}

/** Tile indices under a cleared Den's cache. Nothing is built, piled or budded on them. */
export function tilesUnderCaches(state: GameState): Set<number> {
  const tiles = new Set<number>();
  for (const id of idsOf(state.components.cache)) {
    const t = state.components.tile[id];
    if (t) tiles.add(tileIndex(state.map, t.x, t.y));
  }
  return tiles;
}

/**
 * Whether a building of this type, turned `rotation`, fits with its origin at (x, y): every
 * footprint tile is in bounds, buildable, outside every Den's dark ring, and free of trees, roads
 * (a Gate may stand on one), stockpiles, caches, other footprints and other doors (a wall's door is its own
 * tile, so nothing goes on a wall or its site either); its door tile is in bounds, walkable, not blocked
 * and not on a stockpile (it may be on a road), and on a riverbank if the type needs one. Doesn't check whether the player may place this type.
 */
export function fitsAt(
  state: GameState,
  content: Content,
  type: BuildingId,
  x: number,
  y: number,
  rotation: Rotation = 0,
): boolean {
  const { map } = state;
  const def = content.buildings[type];
  if (!inBounds(map, x, y) || !isRotation(rotation)) return false;
  const layout = buildingLayout(def, { x, y }, rotation);
  const blocked = blockedGrid(state, content);
  const doors = doorTiles(state, content);
  const piles = tilesUnderStockpiles(state);
  const caches = tilesUnderCaches(state);

  for (const t of layout.tiles) {
    if (!inBounds(map, t.x, t.y)) return false;
    const i = tileIndex(map, t.x, t.y);
    const terrain = map.terrain[i];
    if (terrain === undefined || !content.terrain[terrain].buildable) return false;
    if (blocked[i] === 1 || doors.has(i) || piles.has(i) || caches.has(i)) return false;
    if (map.roads[i] !== undefined && !def.wall?.gate) return false;
    // Newcomers arrive on the entry tile: keep it open.
    if (map.entry && t.x === map.entry.x && t.y === map.entry.y) return false;
    if (inDarkRing(state, content, t)) return false;
  }

  const { door } = layout;
  if (!inBounds(map, door.x, door.y)) return false;
  const doorIndex = tileIndex(map, door.x, door.y);
  if (def.doorOnRiverbank && !isRiverbank(state, content, door)) return false;
  return blocked[doorIndex] === 0 && !piles.has(doorIndex) && !caches.has(doorIndex);
}

/** Whether the village has a `type` building, built or under construction. */
function hasOne(state: GameState, type: BuildingId): boolean {
  const { building, site } = state.components;
  return (
    Object.values(building).some((b) => b.type === type) ||
    Object.values(site).some((s) => s.type === type)
  );
}

/** Whether the player may place a building of this type, turned `rotation`, at (x, y) now. */
export function canPlaceBuilding(
  state: GameState,
  content: Content,
  type: BuildingId,
  x: number,
  y: number,
  rotation: Rotation = 0,
): boolean {
  const def = content.buildings[type];
  if (!def?.placeable || !def.construction) return false;
  if (def.onePerVillage && hasOne(state, type)) return false;
  return fitsAt(state, content, type, x, y, rotation);
}
