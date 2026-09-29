// Roads: the per-tile road layer, laying and removing paths, and road speed.
import type { Content } from '@candlemarch/content';
import {
  blockedGrid,
  inBounds,
  palisadeTiles,
  tileAt,
  tileIndex,
  tilesUnderStockpiles,
} from './grid';
import { mapChanged } from './mapCache';
import { staticChanged } from './snapshot';
import type { GameState, MapState, Tile } from './state';

/** Walking speed off-road, as a percentage. Road speeds are relative to it. */
export const OFF_ROAD_SPEED_PERCENT = 100;

// Roads are 4-connected. Offsets in a fixed order.
const ROAD_NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Tiles of the L-shaped path from `from` to `to`: the horizontal leg along `from`'s row, then
 * the vertical leg along `to`'s column. In walking order, each tile once. Ends that aren't
 * whole tiles give tiles that aren't either; `canLayPath` rejects those.
 */
export function lShapeTiles(from: Tile, to: Tile): Tile[] {
  const tiles: Tile[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const across = Math.abs(to.x - from.x);
  const down = Math.abs(to.y - from.y);
  for (let i = 0; i < across; i++) tiles.push({ x: from.x + i * dx, y: from.y });
  for (let i = 0; i < down; i++) tiles.push({ x: to.x, y: from.y + i * dy });
  tiles.push({ x: to.x, y: to.y });
  return tiles;
}

/** Both ends are whole tiles on the map, so the whole L between them is too. */
function endsInBounds(state: GameState, from: Tile, to: Tile): boolean {
  return inBounds(state.map, from.x, from.y) && inBounds(state.map, to.x, to.y);
}

/**
 * Whether a path can be laid along the L from `from` to `to`: every tile is walkable,
 * buildable, and free of trees, building or site footprints, palisade segments (built or not)
 * and stockpiles. Door tiles, Gates and tiles that already hold a path are fine.
 */
export function canLayPath(state: GameState, content: Content, from: Tile, to: Tile): boolean {
  if (!endsInBounds(state, from, to)) return false;
  const { map } = state;
  const blocked = blockedGrid(state, content);
  const piles = tilesUnderStockpiles(state);
  const palisades = palisadeTiles(state, content);
  return lShapeTiles(from, to).every((t) => {
    const i = tileIndex(map, t.x, t.y);
    const terrain = map.terrain[i];
    return (
      terrain !== undefined &&
      content.terrain[terrain].buildable &&
      blocked[i] === 0 &&
      !palisades.has(i) &&
      !piles.has(i)
    );
  });
}

/** Lays a dirt path along the L from `from` to `to`, or nothing if any tile of it is invalid. */
export function layPath(state: GameState, content: Content, from: Tile, to: Tile): void {
  if (!canLayPath(state, content, from, to)) return;
  const { map } = state;
  let laid = false;
  for (const t of lShapeTiles(from, to)) {
    const i = tileIndex(map, t.x, t.y);
    if (map.roads[i] === 'dirt_path') continue;
    map.roads[i] = 'dirt_path';
    laid = true;
  }
  if (!laid) return;
  mapChanged(state);
  staticChanged(state);
}

/** Removes every road tile along the L from `from` to `to`. Ignored if an end is off the map. */
export function removePath(state: GameState, from: Tile, to: Tile): void {
  if (!endsInBounds(state, from, to)) return;
  const { map } = state;
  let removed = false;
  for (const t of lShapeTiles(from, to)) {
    const i = tileIndex(map, t.x, t.y);
    if (map.roads[i] === undefined) continue;
    delete map.roads[i];
    removed = true;
  }
  if (!removed) return;
  mapChanged(state);
  staticChanged(state);
}

/** Tile indices of the road tiles sharing an edge with tile `index`: +x, +y, −x, −y. */
export function roadNeighbours(map: MapState, index: number): number[] {
  const { x, y } = tileAt(map, index);
  const result: number[] = [];
  for (const [dx, dy] of ROAD_NEIGHBOURS) {
    if (!inBounds(map, x + dx, y + dy)) continue;
    const next = tileIndex(map, x + dx, y + dy);
    if (map.roads[next] !== undefined) result.push(next);
  }
  return result;
}

/** Walking speed on tile `index` as a percentage: its road's, or the off-road speed. */
export function speedPercentAt(map: MapState, content: Content, index: number): number {
  const road = map.roads[index];
  return road === undefined ? OFF_ROAD_SPEED_PERCENT : content.roads[road].speedPercent;
}

/** Walking speed percent of every tile, row-major. */
export function speedPercentGrid(map: MapState, content: Content): Uint16Array {
  return Uint16Array.from({ length: map.width * map.height }, (_, i) =>
    speedPercentAt(map, content, i),
  );
}

/** The fastest walking speed percent anywhere: the fastest road's, or the off-road speed. */
export function maxSpeedPercent(content: Content): number {
  const roadSpeeds = Object.values(content.roads).map((r) => r.speedPercent);
  return Math.max(OFF_ROAD_SPEED_PERCENT, ...roadSpeeds);
}
