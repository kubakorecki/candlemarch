// Monster Dens and the Monster rate: the rules other modules ask about. The nightly work (spawns,
// budding, Gloamlings vanishing) is `systems/dens.ts`.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import type { GameState, Tile } from './state';

/** Whether `rate` is a valid Monster rate: a whole number from 0 to 100. */
export function isMonsterRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isInteger(rate) && rate >= 0 && rate <= 100;
}

/** Tiles of every Den, in ID order. */
export function denTiles(state: GameState): Tile[] {
  const { den, tile } = state.components;
  const tiles: Tile[] = [];
  for (const id of idsOf(den)) {
    const t = tile[id];
    if (t) tiles.push(t);
  }
  return tiles;
}

/** Whether `tile` is in a Den's dark ring (Chebyshev distance), where nothing can be built. */
export function inDarkRing(state: GameState, content: Content, tile: Tile): boolean {
  const ring = content.dens.darkRingTiles;
  return denTiles(state).some(
    (d) => Math.abs(d.x - tile.x) <= ring && Math.abs(d.y - tile.y) <= ring,
  );
}

/** Every map tile in a Den's dark ring, row by row. For the placement preview. */
export function darkRingTiles(state: GameState, content: Content): Tile[] {
  const dens = denTiles(state);
  if (dens.length === 0) return [];
  const result: Tile[] = [];
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (inDarkRing(state, content, { x, y })) result.push({ x, y });
    }
  }
  return result;
}
