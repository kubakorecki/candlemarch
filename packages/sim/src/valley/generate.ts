// The procedural Valley (spec, World and map: "The Valley", "Forest ecology"): a `MapDef` built
// from a seed with the seeded PRNG alone, so the same seed always gives the same Valley.
import type { Content, MapObjectId, PoiId, TerrainId } from '@candlemarch/content';
import type { MapDef } from '../map';
import { nextU32, type RngHolder, randomInt, seedRng } from '../rng';
import type { Tile } from '../state';
import { forestStretches } from './grounds';
import {
  CAMP_MARGIN,
  chebyshev,
  flood,
  type Layout,
  layOutValley,
  neighbours,
  type Rect,
} from './layout';

/** A generated Valley: a map a new game starts on, plus where its parts lie. */
export interface Valley extends MapDef {
  /**
   * The seed the layout came from: the one asked for, or one derived from it when a Valley missed
   * a guarantee.
   */
  layoutSeed: number;
  /** The Granary's origin: distances "from the Camp" are measured from it. */
  camp: Tile;
  /** The Side valley's walkable tiles, as ascending tile indices. */
  sideValley: number[];
  /** The Pass's snow tiles, as ascending tile indices. */
  pass: number[];
}

/** A Hunting ground the generator cut from the Forest. */
interface Ground {
  name: string;
  tiles: number[];
  maxGame: number;
}

/**
 * The Valley for `seed`. If a layout misses one of `content.valley.guarantees` (or a count), the
 * next try uses a seed derived from the last; throws after `content.valley.attempts` tries.
 */
export function generateValley(seed: number, content: Content): Valley {
  let layoutSeed = seedRng(seed);
  const problems: string[] = [];
  for (let attempt = 0; attempt < content.valley.attempts; attempt++) {
    const rng = { rng: layoutSeed };
    const layout = turned(layOutValley(rng, content), randomInt(rng, 8));
    const grounds = huntingGrounds(layout, content, rng);
    const found = valleyProblems(layout, grounds, content);
    if (found.length === 0) return toValley(layout, grounds, content, layoutSeed);
    problems.push(`${layoutSeed}: ${found.join('; ')}`);
    layoutSeed = nextU32({ rng: layoutSeed });
  }
  throw new Error(`no Valley for seed ${seed} met the guarantees:\n${problems.join('\n')}`);
}

/**
 * `layout` turned or mirrored by `symmetry` (0–7): bit 4 swaps x and y, then bit 1 mirrors x and
 * bit 2 mirrors y.
 */
function turned(layout: Layout, symmetry: number): Layout {
  const n = layout.size;
  const move = (t: Tile): Tile => {
    let x = symmetry & 4 ? t.y : t.x;
    let y = symmetry & 4 ? t.x : t.y;
    if (symmetry & 1) x = n - 1 - x;
    if (symmetry & 2) y = n - 1 - y;
    return { x, y };
  };
  // Which old tile each new tile comes from, so the new arrays fill in order.
  const from = new Int32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const t = move({ x, y });
      from[t.y * n + t.x] = y * n + x;
    }
  }
  const list = <T>(old: readonly T[]): T[] => {
    const turnedList: T[] = [];
    for (let j = 0; j < n * n; j++) turnedList.push(old[from[j] as number] as T);
    return turnedList;
  };
  const bits = (old: Uint8Array) => {
    const turnedBits = new Uint8Array(n * n);
    for (let j = 0; j < n * n; j++) turnedBits[j] = old[from[j] as number] as number;
    return turnedBits;
  };
  const a = move(layout.clear);
  const b = move({
    x: layout.clear.x + layout.clear.w - 1,
    y: layout.clear.y + layout.clear.h - 1,
  });
  const clear: Rect = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  };
  return {
    size: n,
    terrain: list(layout.terrain),
    object: list(layout.object),
    den: bits(layout.den),
    poi: list(layout.poi),
    sideValley: bits(layout.sideValley),
    forest: bits(layout.forest),
    entry: move(layout.entry),
    camp: move(layout.camp),
    clear,
  };
}

/** Hunting grounds cut from the Forest, named from `content.valley.huntingGrounds.names`. */
function huntingGrounds(layout: Layout, content: Content, rng: RngHolder): Ground[] {
  const { maxTiles, minTiles, treesPerGame, names } = content.valley.huntingGrounds;
  const n = layout.size;
  const forest = [...layout.forest.keys()].filter((i) => layout.forest[i] === 1);
  const shuffled = [...names];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j] as string, shuffled[i] as string];
  }
  const grounds: Ground[] = [];
  for (const tiles of forestStretches(n, forest, maxTiles, minTiles)) {
    const trees = tiles.filter((i) => layout.object[i] === content.hunting.forest).length;
    const maxGame = Math.floor(trees / treesPerGame);
    if (maxGame === 0) continue;
    const k = grounds.length;
    const name = shuffled[k % shuffled.length] as string;
    const round = Math.floor(k / shuffled.length);
    grounds.push({ name: round === 0 ? name : `${name} ${round + 1}`, tiles, maxGame });
  }
  return grounds;
}

/** What `layout` misses of the Valley's guarantees and counts; empty when it's good. */
function valleyProblems(layout: Layout, grounds: Ground[], content: Content): string[] {
  const { size: n, terrain, object, den, poi, sideValley } = layout;
  const v = content.valley;
  const g = v.guarantees;
  const problems: string[] = [];
  const camp = layout.camp.y * n + layout.camp.x;
  const all = [...terrain.keys()];
  const fromCamp = Int32Array.from(all, (i) => chebyshev(n, i, camp));
  const near = (i: number, tiles: number) => (fromCamp[i] as number) <= tiles;
  const count = (tiles: number[], type: MapObjectId) =>
    tiles.filter((i) => object[i] === type).length;

  const { clear } = layout;
  for (let y = clear.y; y < clear.y + clear.h; y++) {
    for (let x = clear.x; x < clear.x + clear.w; x++) {
      const i = y * n + x;
      if (terrain[i] !== 'meadow' || object[i] !== null || den[i]) {
        problems.push(`the clear square has ${terrain[i]} ${object[i] ?? ''} at ${x},${y}`);
        break;
      }
    }
  }
  const { entry } = layout;
  if (
    Math.max(Math.abs(entry.x - layout.camp.x), Math.abs(entry.y - layout.camp.y)) >
    v.camp.entryTiles
  ) {
    problems.push('the Camp is too far from the entry');
  }
  const trees = count(
    all.filter((i) => near(i, g.trees.withinTiles)),
    'tree',
  );
  if (trees < g.trees.count) problems.push(`${trees} trees near the Camp`);
  if (!grounds.some((ground) => ground.tiles.some((i) => near(i, g.trees.withinTiles)))) {
    problems.push('no Hunting ground near the Camp');
  }
  const forage = all.filter(
    (i) => near(i, g.forage.withinTiles) && content.mapObjects[object[i] ?? 'tree'].forage,
  ).length;
  if (forage < g.forage.count) problems.push(`${forage} Forage patches near the Camp`);
  const riverbank = (i: number) =>
    content.terrain[terrain[i] as TerrainId].walkable &&
    neighbours(n, i).some((j) => terrain[j] === 'river');
  if (!all.some((i) => near(i, g.riverbankTiles) && riverbank(i)))
    problems.push('no Riverbank near the Camp');
  if (!all.some((i) => near(i, g.fordTiles) && terrain[i] === 'ford'))
    problems.push('no Ford near the Camp');
  for (const type of ['stone_deposit', 'clay_deposit'] as const) {
    if (!all.some((i) => near(i, g.depositTiles) && object[i] === type))
      problems.push(`no ${type} near the Camp`);
  }
  if (all.some((i) => den[i] && near(i, g.denTiles))) problems.push('a Den near the Camp');

  const wanted: [MapObjectId, number][] = [
    ['stone_deposit', v.deposits.stone],
    ['clay_deposit', v.deposits.clay],
    ['iron_deposit', v.deposits.iron],
  ];
  for (const [type, want] of wanted) {
    if (count(all, type) !== want) problems.push(`${count(all, type)} ${type}`);
  }
  const ironInSide = all.filter(
    (i) =>
      object[i] === 'iron_deposit' &&
      neighbours(n, i).some((j) => sideValley[j] && terrain[j] !== 'mountain'),
  ).length;
  if (ironInSide !== v.deposits.iron) problems.push('iron outside the Side valley');
  const dens = all.filter((i) => den[i]);
  if (dens.length !== v.dens.count) problems.push(`${dens.length} Dens`);
  if (dens.filter((i) => sideValley[i]).length < v.dens.sideValley)
    problems.push('no Den in the Side valley');

  // Reach, 4-connected over open tiles and through trees (walked through): the main valley from
  // the entry with the Pass shut, the Side valley only once it's open.
  const start = entry.y * n + entry.x;
  const walks = Uint8Array.from(terrain, (t) => (content.terrain[t].walkable ? 1 : 0));
  const through = (i: number) => {
    const type = object[i];
    return (
      type === null || type === undefined || content.mapObjects[type].walkSpeedPercent !== undefined
    );
  };
  const passable = (passOpen: boolean) => (i: number) =>
    (walks[i] === 1 || (passOpen && terrain[i] === 'pass_snow')) && through(i);
  const shut = flood(n, start, passable(false));
  const opened = flood(n, start, passable(true));
  const isOpen = (i: number) => walks[i] === 1 && object[i] === null;
  const sideTiles = all.filter((i) => sideValley[i] && isOpen(i));
  if (sideTiles.length === 0) problems.push('no Side valley');
  if (sideTiles.some((i) => !opened[i]))
    problems.push('the Side valley is cut off with the Pass open');
  if (sideTiles.some((i) => shut[i])) problems.push('the Side valley is open without the Pass');
  if (all.some((i) => !sideValley[i] && isOpen(i) && !shut[i]))
    problems.push('part of the main valley is cut off');

  // Points of interest: how many, the mine's Den, Ruins and Shrine reached, the Shrine's ward.
  const ofKind: Record<PoiId, number[]> = { ruins: [], abandoned_mine: [], shrine: [] };
  poi.forEach((kind, i) => {
    if (kind) ofKind[kind].push(i);
  });
  const wantedPois: [PoiId, number][] = [
    ['ruins', v.pois.ruins],
    ['abandoned_mine', 1],
    ['shrine', 1],
  ];
  for (const [kind, want] of wantedPois) {
    if (ofKind[kind].length !== want) problems.push(`${ofKind[kind].length} ${kind}`);
  }
  for (const i of ofKind.abandoned_mine) {
    if (object[i] !== 'iron_deposit' || !neighbours(n, i).some((j) => den[j] && sideValley[j]))
      problems.push('an Abandoned mine without its iron or its Den');
  }
  for (const i of [...ofKind.ruins, ...ofKind.shrine]) {
    if (!shut[i] || sideValley[i]) problems.push(`${poi[i]} out of the main valley's reach`);
  }
  const ward = content.pois.shrine.wardTiles ?? 0;
  if (ofKind.shrine.some((i) => dens.some((d) => chebyshev(n, i, d) <= ward)))
    problems.push('a Den by the Shrine');
  return problems;
}

/** The map characters (`MAP_LEGEND`) for each terrain, and for what may stand on it. */
const TERRAIN_CHARS: Record<TerrainId, string> = {
  meadow: '.',
  rock: ':',
  mountain: '^',
  swamp: ',',
  river: '~',
  ford: '_',
  pass_snow: '*',
};
/** An Abandoned mine's character stands for its iron Deposit too. */
const POI_CHARS: Record<PoiId, string> = { ruins: 'R', abandoned_mine: 'M', shrine: 'S' };
const OBJECT_CHARS: Partial<Record<MapObjectId, string>> = {
  tree: 'T',
  berry_bush: 'b',
  mushroom_patch: 'm',
  stone_deposit: 's',
  clay_deposit: 'c',
  iron_deposit: 'i',
};

/** `layout` as a map: rows, entry, the Starting Camp and the Hunting grounds. */
function toValley(layout: Layout, grounds: Ground[], content: Content, layoutSeed: number): Valley {
  const { size: n, terrain, object, den, poi, camp } = layout;
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const type = object[i];
      const kind = poi[i];
      row += den[i]
        ? 'D'
        : kind
          ? POI_CHARS[kind]
          : type
            ? (OBJECT_CHARS[type] ?? '?')
            : TERRAIN_CHARS[terrain[i] as TerrainId];
    }
    rows.push(row);
  }
  const tile = (i: number): Tile => ({ x: i % n, y: Math.floor(i / n) });
  const { carriers, granaryStock, stockpileGoods } = content.valley.camp;
  // Everything within CAMP_MARGIN of the Granary, so on the clear square whichever way it's turned.
  const margin = CAMP_MARGIN - 1;
  return {
    name: 'valley',
    rows,
    entry: layout.entry,
    buildings: [{ type: 'granary', x: camp.x, y: camp.y, stock: granaryStock }],
    stockpiles: [{ x: camp.x - margin, y: camp.y, w: 2, h: 2, goods: stockpileGoods }],
    villagers: Array.from({ length: carriers }, (_, i) => ({
      job: 'carrier' as const,
      x: camp.x - margin + (i % (2 * margin)),
      y: camp.y + margin,
    })),
    hero: { x: camp.x + margin, y: camp.y },
    huntingGrounds: grounds.map(({ name, tiles, maxGame }) => ({
      name,
      tiles: tiles.map(tile),
      maxGame,
    })),
    layoutSeed,
    camp,
    sideValley: [...terrain.keys()].filter(
      (i) => layout.sideValley[i] && content.terrain[terrain[i] as TerrainId].walkable,
    ),
    pass: [...terrain.keys()].filter((i) => terrain[i] === 'pass_snow'),
  };
}
