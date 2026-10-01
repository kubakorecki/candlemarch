// Reserves (spec, World and map, "Forest ecology"): tiles the player paints where woodcutters never
// fell. Foragers, hunters and foresters work there as usual; a Reserve blocks no building. Painted
// and erased free and at once, as a rectangle between two corner tiles. Kept as `map.reserve`
// (`TileBits`), a static layer.
import type { BuildingId, Content } from '@candlemarch/content';
import { allRevealed, clearTile, hasTile, setTile } from './fog';
import { buildingLayout, inBounds, rectTiles, tileIndex } from './grid';
import { staticChanged } from './snapshot';
import type { GameState, Rotation, Tile } from './state';

/** Whether `tile` is in a Reserve. False off the map. */
export function inReserve(state: GameState, tile: Tile): boolean {
  const { map } = state;
  if (!inBounds(map, tile.x, tile.y)) return false;
  return hasTile(map.reserve, tileIndex(map, tile.x, tile.y));
}

/** The tiles of the rectangle with corners `a` and `b`, both included, row by row. */
export function reserveRect(a: Tile, b: Tile): Tile[] {
  const origin = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
  return rectTiles(origin, Math.abs(a.x - b.x) + 1, Math.abs(a.y - b.y) + 1);
}

function cornersOnMap(state: GameState, a: Tile, b: Tile): boolean {
  return inBounds(state.map, a.x, a.y) && inBounds(state.map, b.x, b.y);
}

/**
 * Whether the rectangle with corners `from` and `to` can be painted as a Reserve: both corners on
 * the map and every tile Revealed (Fog). Any terrain, and anything standing on it, is fine.
 */
export function canPaintReserve(state: GameState, from: Tile, to: Tile): boolean {
  return cornersOnMap(state, from, to) && allRevealed(state, reserveRect(from, to));
}

/**
 * Adds tile indices `tiles` to the Reserve, however they were chosen (the paint tool, or a map
 * generator), ignoring Fog. Calls `staticChanged` when any tile was new to it.
 */
export function addToReserve(state: GameState, tiles: readonly number[]): void {
  const { reserve } = state.map;
  let added = false;
  for (const i of tiles) {
    if (hasTile(reserve, i)) continue;
    setTile(reserve, i);
    added = true;
  }
  if (added) staticChanged(state);
}

/** Paints the rectangle with corners `from` and `to` as a Reserve, or nothing if it can't be. */
export function paintReserve(state: GameState, from: Tile, to: Tile): void {
  if (!canPaintReserve(state, from, to)) return;
  const { map } = state;
  addToReserve(
    state,
    reserveRect(from, to).map((t) => tileIndex(map, t.x, t.y)),
  );
}

/** Erases the Reserve from the rectangle with corners `from` and `to`. Ignored off the map. */
export function eraseReserve(state: GameState, from: Tile, to: Tile): void {
  if (!cornersOnMap(state, from, to)) return;
  const { map } = state;
  let erased = false;
  for (const t of reserveRect(from, to)) {
    const i = tileIndex(map, t.x, t.y);
    if (!hasTile(map.reserve, i)) continue;
    clearTile(map.reserve, i);
    erased = true;
  }
  if (erased) staticChanged(state);
}

/** Whether a `type` building fells trees (a woodcutter's hut): the one the Reserve holds back. */
export function fellsTrees(content: Content, type: BuildingId): boolean {
  return content.buildings[type].gathers?.includes(content.hunting.forest) === true;
}

/**
 * The Reserve tiles a `type` building placed at `origin` would have in its work radius, row by row,
 * for its placement preview; none unless it fells trees (a woodcutter's hut).
 */
export function reserveNear(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): Tile[] {
  const def = content.buildings[type];
  const r = def.workRadius;
  if (r === undefined || !fellsTrees(content, type)) return [];
  const { size } = buildingLayout(def, origin, rotation);
  const tiles: Tile[] = [];
  for (let y = origin.y - r; y <= origin.y + size.h - 1 + r; y++) {
    for (let x = origin.x - r; x <= origin.x + size.w - 1 + r; x++) {
      if (inReserve(state, { x, y })) tiles.push({ x, y });
    }
  }
  return tiles;
}
