// Synthetic maps for the map-size benchmark: the same working village at every size, with forest
// filling the rest, so what grows with the map is terrain and trees, not the village.
import type { MapDef } from '@candlemarch/sim';

/** The village block, in tiles. It sits with the river along its south edge. */
const VILLAGE_W = 32;
const VILLAGE_H = 18;
/** Rows of dense forest kept north of the village for its woodcutters and hunters. */
const FOREST_BAND = 10;
/** Villagers in all: the employees the buildings spawn plus free Carriers. */
const VILLAGERS = 50;

/** A hash of a tile to [0, 1), so the maps are the same on every run. */
function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1): hashed lattice every `cell` tiles, blended between. */
function noise(x: number, y: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = (x % cell) / cell;
  const fy = (y % cell) / cell;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(gx, gy, 1) * (1 - sx) + hash(gx + 1, gy, 1) * sx;
  const bottom = hash(gx, gy + 1, 1) * (1 - sx) + hash(gx + 1, gy + 1, 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * A `size`×`size` map (at least 48): forest in patches over roughly two fifths of the land, a
 * river across the map, and in the middle a village of 18 Huts, 2 Granaries full of meat, 3
 * Stockpiles, 24 Workplaces (woodcutters, hunters, foragers, fishers, chopping blocks,
 * watchtowers) with their workers, 26 Carriers and the Hero, joined by dirt paths to the entry on the west edge. Two
 * Hunting grounds cover the wood north of the village.
 */
export function syntheticMap(size: number): MapDef {
  if (size < 48) throw new Error(`synthetic map ${size}: needs at least 48 tiles a side`);
  const ox = Math.floor((size - VILLAGE_W) / 2);
  const oy = Math.floor((size - VILLAGE_H) / 2);
  const riverY = oy + VILLAGE_H;

  const grid: string[][] = [];
  for (let y = 0; y < size; y++) {
    const row: string[] = [];
    for (let x = 0; x < size; x++) {
      const inBand = y >= oy - FOREST_BAND && y < oy && x >= ox && x < ox + VILLAGE_W;
      const wooded = inBand || noise(x, y, 12) > 0.5;
      if (wooded && hash(x, y, 2) < 0.8) row.push('T');
      else if (wooded && hash(x, y, 3) < 0.1) row.push(hash(x, y, 4) < 0.5 ? 'b' : 'm');
      else row.push('.');
    }
    grid.push(row);
  }
  const set = (x: number, y: number, char: string) => {
    const row = grid[y];
    if (row) row[x] = char;
  };
  for (let y = oy; y < riverY; y++) for (let x = ox; x < ox + VILLAGE_W; x++) set(x, y, '.');
  for (let x = 0; x < size; x++) {
    set(x, riverY, '~');
    set(x, riverY + 1, '~');
  }
  // Main street to the west edge, and a cross street down to the river.
  for (let x = 0; x < ox + VILLAGE_W; x++) set(x, oy + 8, '=');
  for (let y = oy; y < riverY - 1; y++) set(ox + 16, y, '=');

  const at = (x: number, y: number) => ({ x: ox + x, y: oy + y });
  const buildings: MapDef['buildings'] = [
    ...[2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 24, 26, 28, 30].map((x) => ({
      type: 'hut' as const,
      ...at(x, 6),
    })),
    ...[2, 4, 6, 8].map((x) => ({ type: 'hut' as const, ...at(x, 10) })),
    { type: 'granary', ...at(10, 10), stock: [{ resource: 'meat', amount: 100 }] },
    { type: 'granary', ...at(13, 10), stock: [{ resource: 'meat', amount: 100 }] },
  ];
  // Each of these employs one worker, spawned with it.
  const workplaces: MapDef['buildings'] = [
    ...[2, 4, 6, 8].map((x) => ({ type: 'chopping_block' as const, ...at(x, 13) })),
    ...[2, 4, 7, 9, 22, 24].map((x) => ({ type: 'woodcutters_hut' as const, ...at(x, 1) })),
    ...[12, 27].map((x) => ({ type: 'hunters_lodge' as const, ...at(x, 2) })),
    ...[14, 18, 20, 29].map((x) => ({ type: 'foragers_hut' as const, ...at(x, 2) })),
    ...[4, 7, 10, 13, 22, 25].map((x) => ({ type: 'fishers_hut' as const, ...at(x, 16) })),
    ...[0, 31].map((x) => ({ type: 'watchtower' as const, ...at(x, 12) })),
  ];
  const villagers = Array.from({ length: VILLAGERS - workplaces.length }, (_, i) => ({
    job: 'carrier' as const,
    ...at(2 + (i % 28), 8),
  }));

  return {
    name: `synthetic${size}`,
    rows: grid.map((row) => row.join('')),
    entry: { x: 0, y: oy + 8 },
    buildings: [...buildings, ...workplaces],
    stockpiles: [
      {
        ...at(18, 10),
        w: 4,
        h: 3,
        goods: [
          { resource: 'logs', amount: 24 },
          { resource: 'firewood', amount: 12 },
        ],
      },
      { ...at(24, 10), w: 4, h: 3 },
      { ...at(18, 14), w: 4, h: 2 },
    ],
    villagers,
    hero: at(16, 9),
    huntingGrounds: [
      { name: 'West Wood', x: ox, y: oy - FOREST_BAND, w: 16, h: FOREST_BAND, maxGame: 20 },
      { name: 'East Wood', x: ox + 16, y: oy - FOREST_BAND, w: 16, h: FOREST_BAND, maxGame: 20 },
    ],
  };
}
