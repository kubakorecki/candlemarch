// Fog (spec, World and map; ADR-0005): a tile is unrevealed, Revealed (seen at least once) or In
// sight (seen now). The sight itself is worked out by `systems/fog.ts`. Fog changes only what the
// player knows and where they may build: no system but that one and placement reads it.
import type { GameState, MapState, Tile, TileBits } from './state';

/** Whether tile index `index` is set in `bits`. */
export function hasTile(bits: TileBits, index: number): boolean {
  return (((bits[index >> 5] ?? 0) >>> (index & 31)) & 1) === 1;
}

/** Sets tile index `index` in `bits`. */
export function setTile(bits: TileBits, index: number): void {
  bits[index >> 5] = (bits[index >> 5] ?? 0) | (1 << (index & 31));
}

/** Clears tile index `index` in `bits`. */
export function clearTile(bits: TileBits, index: number): void {
  bits[index >> 5] = (bits[index >> 5] ?? 0) & ~(1 << (index & 31));
}

/** No tile set, sized for `map`. */
export function noTiles(map: MapState): TileBits {
  return new Array<number>(Math.ceil((map.width * map.height) / 32)).fill(0);
}

/** Every tile set, sized for `map`. */
export function allTiles(map: MapState): TileBits {
  const bits = noTiles(map);
  for (let i = 0; i < map.width * map.height; i++) setTile(bits, i);
  return bits;
}

function onMap(map: MapState, tile: Tile): boolean {
  return (
    Number.isInteger(tile.x) &&
    Number.isInteger(tile.y) &&
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x < map.width &&
    tile.y < map.height
  );
}

/** Whether the player has seen `tile`: always, with Fog off. False off the map. */
export function isRevealed(state: GameState, tile: Tile): boolean {
  const { map } = state;
  if (!onMap(map, tile)) return false;
  return !state.fog || hasTile(map.revealed, tile.y * map.width + tile.x);
}

/** Whether the player sees `tile` right now: always, with Fog off. False off the map. */
export function isInSight(state: GameState, tile: Tile): boolean {
  const { map } = state;
  if (!onMap(map, tile)) return false;
  return !state.fog || hasTile(map.inSight, tile.y * map.width + tile.x);
}

/** Whether every one of `tiles` is Revealed: where buildings, Roads and Stockpiles may go. */
export function allRevealed(state: GameState, tiles: readonly Tile[]): boolean {
  return tiles.every((t) => isRevealed(state, t));
}

/**
 * Turns Fog on or off (the `setFog` command). Revealed tiles are kept either way; the tiles In
 * sight are worked out again on the next tick Fog is on (`fogSystem`).
 */
export function setFog(state: GameState, on: boolean): void {
  state.fog = on;
  if (!on) state.map.inSight = [];
}
