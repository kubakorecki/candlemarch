// The Valley laid out in one fixed orientation: the entry on the west edge, the river crossing
// from west to east north of the Camp, the Side valley in the south-east corner. `generate.ts`
// turns or mirrors the result. Every number is in `content.valley`; the PRNG is the only source
// of chance, drawn in a fixed order.
import type { Content, IntRange, MapObjectId, TerrainId } from '@candlemarch/content';
import { type RngHolder, randomInt } from '../rng';
import type { Tile } from '../state';
import { valueNoise } from './noise';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A Valley as flat per-tile arrays (row-major, `size`×`size`), before it becomes a `MapDef`. */
export interface Layout {
  size: number;
  terrain: TerrainId[];
  /** The map object on each tile, or null. */
  object: (MapObjectId | null)[];
  /** 1 where a Den stands. */
  den: Uint8Array;
  /** 1 on the Side valley's corner pocket (whatever its terrain). */
  sideValley: Uint8Array;
  /** 1 on Forest: the tiles the noise wooded, trees or not. Hunting grounds are cut from it. */
  forest: Uint8Array;
  entry: Tile;
  /** The Granary's origin. The Camp's other pieces stand within `CAMP_MARGIN` of it. */
  camp: Tile;
  /** The clear square of buildable Meadow round the Camp. */
  clear: Rect;
}

/**
 * Tiles the clear square reaches west and north of the Camp's Granary (it reaches the rest of
 * its side east and south). The Camp's pieces stand within this many tiles of the Granary, so they
 * stay on the square whichever way the map is turned.
 */
export const CAMP_MARGIN = 4;

/** Tiles over which the river's winding grows from straight (past the Camp) to its full sway. */
const RIVER_EASE_TILES = 20;

/** Tiles either way of a river column that must lie no further from the bank for a slow bend. */
const BEND_REACH = 4;

/** Open pockets of at most this many tiles inside the Forest are planted over, not reached. */
const POCKET_TILES = 2;

/** Trees' worth of felling that taking away a Forage patch on the way in counts as. */
const FORAGE_COST = 4;

type Tiles = Uint8Array;

/** Lays out a whole Valley from `rng`. The result may still miss a guarantee: the caller checks. */
export function layOutValley(rng: RngHolder, content: Content): Layout {
  const v = content.valley;
  const g = v.guarantees;
  const n = v.size;
  const at = (x: number, y: number) => y * n + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const between = (range: IntRange) => range.min + randomInt(rng, range.max - range.min + 1);

  // Where the entry and the Camp go. The entry's gap opens onto the clear square's west side.
  const ey = Math.floor((n * between(v.entry.alongPercent)) / 100);
  const camp = {
    x: v.camp.entryTiles,
    y: ey + CAMP_MARGIN - 1 - randomInt(rng, 2 * CAMP_MARGIN - 1),
  };
  const clear = {
    x: camp.x - CAMP_MARGIN,
    y: camp.y - CAMP_MARGIN,
    w: g.clearTiles,
    h: g.clearTiles,
  };
  const gapTop = ey - Math.floor(v.entry.gapTiles / 2);

  const rimNoise = valueNoise(rng, n, v.rim.cellTiles);
  const wallNoise = valueNoise(rng, n, v.rim.cellTiles);
  const riverNoise = valueNoise(rng, n, v.river.cellTiles);
  const swampNoise = valueNoise(rng, n, v.swamp.radiusTiles.max);
  const rockNoise = valueNoise(rng, n, v.rock.cellTiles);
  const forestNoise = valueNoise(rng, n, v.forest.cellTiles);
  const scaled = (noise: number, range: IntRange) =>
    range.min + Math.floor(noise * (range.max - range.min + 1));

  const terrain: TerrainId[] = new Array(n * n).fill('meadow');
  const keepClear: Tiles = new Uint8Array(n * n);
  const sideValley: Tiles = new Uint8Array(n * n);

  // The rim, kept thin along the west edge near the Camp so the square and its wood fit.
  const nearTop = camp.y - g.trees.withinTiles - v.river.campBankTiles;
  const nearBottom = camp.y + g.depositTiles;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const edge = Math.min(x, y, n - 1 - x, n - 1 - y);
      let thickness = scaled(rimNoise(x, y), v.rim.thickness);
      if (edge === x && y >= nearTop && y <= nearBottom) {
        thickness = Math.min(thickness, v.entry.nearThickness);
      }
      if (edge < thickness) terrain[at(x, y)] = 'mountain';
    }
  }

  // The Side valley: a corner pocket behind a Mountain wall.
  const px = n - v.sideValley.widthTiles;
  const py = n - v.sideValley.heightTiles;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (x >= px && y >= py) {
        sideValley[at(x, y)] = 1;
        continue;
      }
      const reach = Math.max(px - x, py - y);
      if (reach <= scaled(wallNoise(x, y), v.sideValley.wallThickness)) {
        terrain[at(x, y)] = 'mountain';
      }
    }
  }

  // The river, west edge to east edge: straight past the Camp, its bank `campBankTiles` north of
  // it, then winding. Each column covers the rows between its neighbour's so it has no gaps.
  const { widthTiles, meanderTiles } = v.river;
  const bankRow = camp.y - v.river.campBankTiles;
  const straightTo = clear.x + clear.w;
  const lowest = v.rim.thickness.max + v.river.widthTiles;
  const highest = py - v.sideValley.wallThickness.max - 2 * widthTiles;
  const riverTop = (x: number) => {
    const ease = Math.min(1, Math.max(0, (x - straightTo) / RIVER_EASE_TILES));
    const sway = Math.round((riverNoise(x, 0) * 2 - 1) * meanderTiles * ease);
    return Math.min(highest, Math.max(lowest, bankRow - widthTiles + sway));
  };
  const tops: number[] = [];
  const from: number[] = [];
  const to: number[] = [];
  for (let x = 0; x < n; x++) {
    tops.push(riverTop(x));
    const before = tops[x - 1] ?? (tops[x] as number);
    from.push(Math.min(before, tops[x] as number));
    to.push(Math.max(before, tops[x] as number) + widthTiles - 1);
    for (let y = from[x] as number; y <= (to[x] as number); y++) terrain[at(x, y)] = 'river';
  }

  // Fords: the first within reach of the Camp, the rest further east.
  const fordXs: number[] = [];
  const fords = between(v.river.fords);
  const lastFordX = n - v.rim.thickness.max - v.river.fordWidthTiles - 1;
  let fordX = camp.x + randomInt(rng, g.fordTiles - v.river.fordWidthTiles);
  while (fordXs.length < fords && fordX <= lastFordX) {
    fordXs.push(fordX);
    fordX += v.river.fordSpacingTiles + randomInt(rng, v.river.fordSpacingTiles);
  }
  for (const fx of fordXs) {
    for (let x = fx; x < fx + v.river.fordWidthTiles; x++) {
      for (let y = from[x] as number; y <= (to[x] as number); y++) {
        if (terrain[at(x, y)] === 'river') terrain[at(x, y)] = 'ford';
      }
    }
  }

  // The entry's gap through the rim and the clear square round the Camp.
  for (let y = gapTop; y < gapTop + v.entry.gapTiles; y++) {
    for (let x = 0; x < clear.x; x++) {
      terrain[at(x, y)] = 'meadow';
      keepClear[at(x, y)] = 1;
    }
  }
  for (let y = clear.y; y < clear.y + clear.h; y++) {
    for (let x = clear.x; x < clear.x + clear.w; x++) {
      terrain[at(x, y)] = 'meadow';
      keepClear[at(x, y)] = 1;
    }
  }

  // Swamp beside the river's slow bends, past the Camp's square.
  const rMax = v.swamp.radiusTiles.max;
  const firstBend = clear.x + clear.w + rMax;
  const lastBend = n - v.rim.thickness.max - rMax - 1;
  const bends: { x: number; south: boolean }[] = [];
  for (let x = firstBend; x <= lastBend; x++) {
    const near = [];
    for (let k = 1; k <= BEND_REACH; k++) near.push(tops[x - k] as number, tops[x + k] as number);
    const top = tops[x] as number;
    const south = near.every((t) => t <= top);
    const north = near.every((t) => t >= top);
    const last = bends[bends.length - 1];
    if ((south || north) && (!last || x - last.x > 2 * rMax)) bends.push({ x, south });
  }
  const patches = between(v.swamp.patches);
  for (let i = 0; i < patches && bends.length > 0; i++) {
    const [bend] = bends.splice(randomInt(rng, bends.length), 1);
    if (!bend) break;
    const rx = between(v.swamp.radiusTiles);
    const ry = between(v.swamp.radiusTiles);
    const cy = bend.south ? (to[bend.x] as number) + ry : (from[bend.x] as number) - ry;
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = bend.x - rx; x <= bend.x + rx; x++) {
        if (!inMap(x, y)) continue;
        const i = at(x, y);
        const spread = ((x - bend.x) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (terrain[i] !== 'meadow' || keepClear[i] || sideValley[i]) continue;
        if (spread <= 0.7 + 0.6 * swampNoise(x, y)) terrain[i] = 'swamp';
      }
    }
  }

  // The Pass: Pass snow straight through the Side valley's west or north wall.
  const pw = v.sideValley.passWidthTiles;
  const throughWest = randomInt(rng, 2) === 0;
  const passLow = (throughWest ? py : px) + 2;
  const passHigh = n - v.rim.thickness.max - 3 - pw;
  const passAt = passLow + randomInt(rng, Math.max(1, passHigh - passLow + 1));
  for (let k = passAt; k < passAt + pw; k++) {
    // From the pocket's edge outward, then inward, over every Mountain tile in line.
    for (const dir of [-1, 1]) {
      let d = dir < 0 ? -1 : 0;
      for (;;) {
        const x = throughWest ? px + d : k;
        const y = throughWest ? k : py + d;
        if (!inMap(x, y) || terrain[at(x, y)] !== 'mountain') break;
        terrain[at(x, y)] = 'pass_snow';
        d += dir;
      }
    }
  }

  // Rock outcrops at the foot of the Mountains, and one sure outcrop south-west of the Camp.
  const foot = v.rock.footTiles;
  // Within `foot` tiles (Chebyshev) of a Mountain: spread each Mountain across, then down.
  const across: Tiles = new Uint8Array(n * n);
  const nearMountain: Tiles = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (terrain[i] !== 'mountain') continue;
    const x = i % n;
    for (let ax = Math.max(0, x - foot); ax <= Math.min(n - 1, x + foot); ax++)
      across[i - x + ax] = 1;
  }
  for (let i = 0; i < n * n; i++) {
    if (!across[i]) continue;
    const y = Math.floor(i / n);
    for (let ay = Math.max(0, y - foot); ay <= Math.min(n - 1, y + foot); ay++) {
      nearMountain[i + (ay - y) * n] = 1;
    }
  }
  const rocky: number[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = at(x, y);
      if (terrain[i] !== 'meadow' || keepClear[i] || !nearMountain[i]) continue;
      if (rockNoise(x, y) * 100 >= v.rock.thresholdPercent) rocky.push(i);
    }
  }
  for (const i of rocky) terrain[i] = 'rock';
  const stoneY =
    clear.y + clear.h + 2 + randomInt(rng, camp.y + g.depositTiles - clear.y - clear.h - 2);
  let stoneX = 0;
  while (stoneX < n - 1 && terrain[at(stoneX, stoneY)] === 'mountain') stoneX += 1;
  const campStone = { x: stoneX + 1, y: stoneY };
  for (let y = campStone.y - 1; y <= campStone.y + 1; y++) {
    for (let x = campStone.x - 1; x <= campStone.x + 1; x++) {
      if (inMap(x, y) && terrain[at(x, y)] === 'meadow') terrain[at(x, y)] = 'rock';
    }
  }

  // Walkable ground the entry can't reach, even over the Pass, is Mountain.
  const walkable = (i: number) =>
    content.terrain[terrain[i] as TerrainId].walkable || terrain[i] === 'pass_snow';
  const reached = flood(n, at(0, ey), walkable);
  for (let i = 0; i < n * n; i++) if (walkable(i) && !reached[i]) terrain[i] = 'mountain';

  // Forest, and the Camp's own wood between it and the river.
  const object: (MapObjectId | null)[] = new Array(n * n).fill(null);
  const forest: Tiles = new Uint8Array(n * n);
  const reach = g.trees.withinTiles;
  const { thresholdPercent, treePercent, campTreePercent, foragePercent } = v.forest;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = at(x, y);
      if (terrain[i] !== 'meadow' || keepClear[i]) continue;
      const campWood = Math.abs(x - camp.x) <= reach && y >= camp.y - reach && y < clear.y;
      if (!campWood && forestNoise(x, y) * 100 < thresholdPercent) continue;
      forest[i] = 1;
      const roll = randomInt(rng, 100);
      if (roll < foragePercent) {
        object[i] = randomInt(rng, 2) === 0 ? 'berry_bush' : 'mushroom_patch';
      } else if (roll < foragePercent + (campWood ? campTreePercent : treePercent)) {
        object[i] = 'tree';
      }
    }
  }

  // Deposits: a stone and a clay near the Camp, the rest anywhere they fit; iron in the Side valley.
  const placed: number[] = [];
  const spaced = (i: number) => placed.every((p) => chebyshev(n, p, i) >= v.deposits.spacingTiles);
  const place = (type: MapObjectId, count: number, candidates: number[]) => {
    let left = count;
    while (left > 0 && candidates.length > 0) {
      const [i] = candidates.splice(randomInt(rng, candidates.length), 1);
      if (i === undefined || !spaced(i)) continue;
      object[i] = type;
      placed.push(i);
      left -= 1;
    }
  };
  const table = neighbourTable(n);
  const beside = (i: number, test: (j: number) => boolean) => {
    for (let e = i * 4; e < i * 4 + 4; e++) {
      const j = table[e] as number;
      if (j >= 0 && test(j)) return true;
    }
    return false;
  };
  const riverbank = (i: number) => beside(i, (j) => terrain[j] === 'river');
  const all = [...terrain.keys()];
  const campStoneAt = at(campStone.x, campStone.y);
  if (terrain[campStoneAt] === 'rock') place('stone_deposit', 1, [campStoneAt]);
  const campClay = all.filter(
    (i) =>
      Math.floor(i / n) === bankRow &&
      i % n >= clear.x &&
      i % n < clear.x + clear.w &&
      terrain[i] === 'meadow' &&
      riverbank(i),
  );
  place('clay_deposit', 1, campClay);
  const mainValley = (i: number) => !sideValley[i] && !keepClear[i] && !placed.includes(i);
  place(
    'stone_deposit',
    v.deposits.stone - 1,
    all.filter((i) => terrain[i] === 'rock' && mainValley(i)),
  );
  place(
    'clay_deposit',
    v.deposits.clay - 1,
    all.filter((i) => terrain[i] === 'meadow' && mainValley(i) && riverbank(i)),
  );
  const openBeside = (i: number) =>
    beside(i, (j) => sideValley[j] === 1 && content.terrain[terrain[j] as TerrainId].walkable);
  place(
    'iron_deposit',
    v.deposits.iron,
    all.filter((i) => terrain[i] === 'mountain' && openBeside(i)),
  );

  const layout: Layout = {
    size: n,
    terrain,
    object,
    den: new Uint8Array(n * n),
    sideValley,
    forest,
    entry: { x: 0, y: ey },
    camp,
    clear,
  };
  connect(layout, content, false);
  connect(layout, content, true);
  dropUnshaded(layout, content);
  placeDens(layout, content, rng, keepClear);
  return layout;
}

/** Chebyshev distance between tile indices `a` and `b` on a map `n` wide. */
export function chebyshev(n: number, a: number, b: number): number {
  return Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));
}

/** The 4-neighbours of tile index `i` on an `n`×`n` map. */
export function neighbours(n: number, i: number): number[] {
  const x = i % n;
  const result: number[] = [];
  if (x + 1 < n) result.push(i + 1);
  if (i + n < n * n) result.push(i + n);
  if (x > 0) result.push(i - 1);
  if (i - n >= 0) result.push(i - n);
  return result;
}

const tables = new Map<number, Int32Array>();

/**
 * The 4-neighbours of every tile of an `n`×`n` map, 4 entries a tile (the tile's index × 4 on),
 * -1 off the map. Worked out once per size: the generator's floods read it in their inner loops.
 */
export function neighbourTable(n: number): Int32Array {
  let table = tables.get(n);
  if (!table) {
    table = new Int32Array(n * n * 4).fill(-1);
    for (let i = 0; i < n * n; i++) {
      neighbours(n, i).forEach((j, k) => {
        (table as Int32Array)[i * 4 + k] = j;
      });
    }
    tables.set(n, table);
  }
  return table;
}

/** 1 on every tile 4-connected to `start` through tiles `open` lets through. */
export function flood(n: number, start: number, open: (i: number) => boolean): Tiles {
  const reached: Tiles = new Uint8Array(n * n);
  if (!open(start)) return reached;
  const table = neighbourTable(n);
  reached[start] = 1;
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop() as number;
    for (let k = i * 4; k < i * 4 + 4; k++) {
      const j = table[k] as number;
      if (j < 0 || reached[j] || !open(j)) continue;
      reached[j] = 1;
      stack.push(j);
    }
  }
  return reached;
}

/**
 * Fells the fewest trees that join every open tile to the entry (over the Pass when `passOpen`),
 * and gives every Forage patch and Deposit an open side tile joined to it; a Forage patch goes
 * only where no trees would do, and Deposits never. Tiny pockets inside the Forest are planted
 * over instead. Walking is 4-connected here, as the sim's reach test is.
 */
function connect(layout: Layout, content: Content, passOpen: boolean): void {
  const { size: n, terrain, object } = layout;
  const table = neighbourTable(n);
  // What stepping onto each tile costs (`stepCost`), -1 where nobody gets through.
  const cost = new Int8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const walks =
      content.terrain[terrain[i] as TerrainId].walkable || (passOpen && terrain[i] === 'pass_snow');
    cost[i] = walks ? stepCost(content, object[i] ?? null) : -1;
  }
  const walkable = (i: number) =>
    content.terrain[terrain[i] as TerrainId].walkable || (passOpen && terrain[i] === 'pass_snow');
  const open = (i: number) => cost[i] === 0 && object[i] === null;

  // Trees in the way from the entry to each tile, along the path needing fewest: a bucket queue.
  const felled = new Int32Array(n * n).fill(-1);
  const parent = new Int32Array(n * n).fill(-1);
  const start = layout.entry.y * n + layout.entry.x;
  felled[start] = 0;
  const buckets: number[][] = [[start]];
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d] ?? [];
    for (let k = 0; k < bucket.length; k++) {
      const i = bucket[k] as number;
      if (felled[i] !== d) continue;
      for (let e = i * 4; e < i * 4 + 4; e++) {
        const j = table[e] as number;
        const step = j < 0 ? -1 : (cost[j] as number);
        if (step < 0) continue;
        const nd = d + step;
        const known = felled[j] as number;
        if (known !== -1 && known <= nd) continue;
        felled[j] = nd;
        parent[j] = i;
        let target = buckets[nd];
        if (!target) {
          target = [];
          buckets[nd] = target;
        }
        target.push(j);
      }
    }
  }

  // Open regions; the entry's is joined already.
  const region = new Int32Array(n * n);
  const members: number[][] = [[]];
  for (let i = 0; i < n * n; i++) {
    if (!open(i) || region[i]) continue;
    const id = members.length;
    const tiles: number[] = [];
    members.push(tiles);
    region[i] = id;
    const stack = [i];
    while (stack.length > 0) {
      const t = stack.pop() as number;
      tiles.push(t);
      for (let e = t * 4; e < t * 4 + 4; e++) {
        const u = table[e] as number;
        if (u < 0 || region[u] || !open(u)) continue;
        region[u] = id;
        stack.push(u);
      }
    }
  }
  const joined: Tiles = new Uint8Array(n * n);
  // Back along the path to the first tile joined already, felling its trees and joining every
  // region it crosses.
  const join = (from: number) => {
    const path: number[] = [];
    for (let t = from; t >= 0 && !joined[t]; t = parent[t] as number) path.push(t);
    for (const t of path) {
      object[t] = null;
      const r = region[t] as number;
      if (r > 0) for (const u of members[r] ?? []) joined[u] = 1;
      else joined[t] = 1;
    }
  };
  const startRegion = region[start] as number;
  for (const u of members[startRegion] ?? []) joined[u] = 1;

  // A pocket of a tile or two walled in by the Forest gets a tree instead: cheaper than felling.
  for (const tiles of members) {
    if (tiles.length === 0 || tiles.length > POCKET_TILES || joined[tiles[0] as number]) continue;
    if (!tiles.every((t) => terrain[t] === 'meadow' && layout.forest[t])) continue;
    for (const t of tiles) object[t] = 'tree';
  }
  for (let i = 0; i < n * n; i++) {
    if (open(i) && !joined[i] && (felled[i] as number) >= 0) join(i);
  }
  for (let i = 0; i < n * n; i++) {
    const type = object[i];
    if (!type || type === 'tree') continue;
    const sides = neighbours(n, i).filter((j) => walkable(j) && (felled[j] as number) >= 0);
    if (sides.some((j) => joined[j] && object[j] === null)) continue;
    const best = sides.sort((a, b) => (felled[a] as number) - (felled[b] as number) || a - b)[0];
    if (best !== undefined) join(best);
  }
}

/**
 * What clearing a tile with `type` on it costs on a way in: nothing when it's empty, a tree 1, a
 * Forage patch more (taken away only when no trees would do), and never a Deposit (-1).
 */
function stepCost(content: Content, type: MapObjectId | null): number {
  if (type === null) return 0;
  if (type === 'tree') return 1;
  return content.mapObjects[type].forage ? FORAGE_COST : -1;
}

/** Takes away Forage patches with no tree to shade them (felling above can leave some bare). */
function dropUnshaded(layout: Layout, content: Content): void {
  const { size: n, object } = layout;
  for (let i = 0; i < n * n; i++) {
    const type = object[i];
    const forage = type ? content.mapObjects[type].forage : undefined;
    if (!forage) continue;
    const reach = forage.shadeTiles;
    const x = i % n;
    const y = (i - x) / n;
    let shaded = false;
    for (let dy = -reach; dy <= reach && !shaded; dy++) {
      for (let dx = -reach; dx <= reach && !shaded; dx++) {
        const ax = x + dx;
        const ay = y + dy;
        if (ax < 0 || ay < 0 || ax >= n || ay >= n) continue;
        shaded = object[ay * n + ax] === forage.shadedBy;
      }
    }
    if (!shaded) object[i] = null;
  }
}

/**
 * Dens on open Meadow the entry can reach (over the Pass), further than `denTiles` from the Camp
 * and `spacingTiles` apart: first those in the Side valley, then the rest outside it.
 */
function placeDens(layout: Layout, content: Content, rng: RngHolder, keepClear: Tiles): void {
  const { size: n, terrain, object, sideValley, den } = layout;
  const { dens, guarantees } = content.valley;
  const reached = flood(
    n,
    layout.entry.y * n + layout.entry.x,
    (i) =>
      (content.terrain[terrain[i] as TerrainId].walkable || terrain[i] === 'pass_snow') &&
      object[i] === null,
  );
  const camp = layout.camp.y * n + layout.camp.x;
  const placed: number[] = [];
  const candidates = (inSide: boolean) =>
    [...terrain.keys()].filter(
      (i) =>
        terrain[i] === 'meadow' &&
        object[i] === null &&
        reached[i] === 1 &&
        !keepClear[i] &&
        (sideValley[i] === 1) === inSide &&
        chebyshev(n, i, camp) > guarantees.denTiles,
    );
  const pick = (count: number, from: number[]) => {
    let left = count;
    while (left > 0 && from.length > 0) {
      const [i] = from.splice(randomInt(rng, from.length), 1);
      if (i === undefined || placed.some((p) => chebyshev(n, p, i) < dens.spacingTiles)) continue;
      den[i] = 1;
      placed.push(i);
      left -= 1;
    }
  };
  pick(dens.sideValley, candidates(true));
  pick(dens.count - dens.sideValley, candidates(false));
}
