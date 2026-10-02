// Placeholder art drawn in code: bold ink outlines, flat earthy fills. Colours come from palette.ts.
import type { ResourceAmount, ResourceId, RoadId, TerrainId } from '@candlemarch/content';
import type { BuildingLayout, FieldTile, Tile } from '@candlemarch/sim';
import type { Graphics } from 'pixi.js';
import { gridToWorld, TILE_H, TILE_W, type Vec } from './iso';
import { palette } from './palette';
import { type TreeLook, type TreeSpecies, tileHash } from './treeLooks';

export const INK = { width: 3, color: palette.ink, join: 'round', cap: 'round' } as const;
export const THIN_INK = { width: 2, color: palette.ink, join: 'round', cap: 'round' } as const;

/** Wall and roof heights scale with the tile so art keeps its proportions if TILE_W changes. */
export const WALL_H = TILE_H * 0.9;
export const ROOF_H = TILE_H * 0.85;
/** Depth of the map's front edge. */
const EDGE_H = TILE_H * 0.35;

export function flat(points: Vec[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function up(p: Vec, h: number): Vec {
  return { x: p.x, y: p.y - h };
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** World corners of a rectangle of tiles: top, right, bottom, left. */
export function diamond(x: number, y: number, w = 1, h = 1): [Vec, Vec, Vec, Vec] {
  return [
    gridToWorld(x, y),
    gridToWorld(x + w, y),
    gridToWorld(x + w, y + h),
    gridToWorld(x, y + h),
  ];
}

/** A rectangle of tiles: the ground is drawn a chunk at a time, so off-screen chunks can be culled. */
export interface TileChunk {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the ground layers need to know about the map. `terrain` is row-major, as in the sim. */
export interface GroundMap {
  width: number;
  height: number;
  terrain: readonly TerrainId[];
  frozen: boolean;
}

function terrainAt(map: GroundMap, x: number, y: number): TerrainId | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.terrain[y * map.width + x];
}

/**
 * How the ground's ink edges group terrain: an edge is drawn where a tile meets a lower group.
 * Meadow, Rock and Swamp are all open land; a Ford is part of its river; Mountain and Pass snow
 * are walled off from everything round them.
 */
const EDGE_GROUP: Record<TerrainId, number> = {
  meadow: 0,
  rock: 0,
  swamp: 0,
  river: 1,
  ford: 1,
  mountain: 2,
  pass_snow: 3,
};

/** The two checker shades of flat land terrain; water, Mountain and Pass snow are drawn apart. */
const LAND_SHADES: Partial<Record<TerrainId, readonly [number, number]>> = {
  meadow: [palette.meadow, palette.meadowAlt],
  rock: [palette.rock, palette.rockAlt],
  swamp: [palette.swamp, palette.swampAlt],
};

/** A small whole number from a tile's position, so tile details vary without looking tiled. */
function tileVariant(x: number, y: number, n: number): number {
  return (x * 7 + y * 13 + ((x * y) % 5)) % n;
}

/**
 * The ground is drawn in layers, each a chunk at a time, in this order across the whole map:
 * `drawGroundEdge` (the earthen front edge), `drawLand`, `drawGridLines`, `drawWater`,
 * `drawEdges`, `drawMapOutline`, then `drawRelief`. Checkered land, faint grid lines, then river
 * and Ford tiles as flat water (pale cracked ice when frozen), ink where terrain groups meet, and
 * last the Mountains' peaks, over all the rest.
 */
export function drawGroundEdge(g: Graphics, width: number, height: number): void {
  g.clear();
  const [, right, bottom, left] = diamond(0, 0, width, height);
  // Front edges, so the map reads as a slab of land.
  g.poly(flat([left, bottom, up(bottom, -EDGE_H), up(left, -EDGE_H)]))
    .fill(palette.trunk)
    .stroke(INK);
  g.poly(flat([bottom, right, up(right, -EDGE_H), up(bottom, -EDGE_H)]))
    .fill(palette.door)
    .stroke(INK);
}

/**
 * Every tile of `chunk` but water, row by row: checkered Meadow, Rock (with cracks and pebbles)
 * and Swamp (with pools and reeds); Mountain as dark rock (`drawRelief` raises its peaks); Pass
 * snow as a white drift.
 */
export function drawLand(g: Graphics, chunk: TileChunk, map: GroundMap): void {
  g.clear();
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      const terrain = terrainAt(map, x, y);
      const shades = terrain && LAND_SHADES[terrain];
      if (shades) g.poly(flat(diamond(x, y))).fill(shades[(x + y) % 2]);
      if (terrain === 'rock') drawRockDetail(g, x, y);
      else if (terrain === 'swamp') drawSwampDetail(g, x, y);
      else if (terrain === 'mountain') drawMountainTile(g, x, y);
      else if (terrain === 'pass_snow') drawSnowTile(g, x, y);
    }
  }
}

function drawRockDetail(g: Graphics, x: number, y: number): void {
  const v = tileVariant(x, y, 3);
  const a = gridToWorld(x + 0.2, y + 0.35 + v * 0.1);
  const b = gridToWorld(x + 0.5, y + 0.5);
  const c = gridToWorld(x + 0.6, y + 0.85 - v * 0.1);
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y);
  g.stroke({ width: 1.5, color: palette.rockCrack, alpha: 0.8 });
  const s = TILE_H / 64;
  const p = gridToWorld(x + 0.7, y + 0.3 + v * 0.15);
  g.ellipse(p.x, p.y, 5 * s, 3 * s)
    .fill(palette.stone)
    .stroke({ ...THIN_INK, width: 1.5 });
}

function drawSwampDetail(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  const v = tileVariant(x, y, 4);
  const pool = gridToWorld(x + 0.35 + v * 0.08, y + 0.55);
  g.ellipse(pool.x, pool.y, 16 * s, 6 * s).fill(palette.swampWater);
  const reed = gridToWorld(x + 0.7, y + 0.3 + v * 0.05);
  for (const dx of [-3, 0, 3]) {
    g.moveTo(reed.x + dx * s, reed.y).lineTo(reed.x + dx * 1.6 * s, reed.y - 10 * s);
  }
  g.stroke({ width: 1.5 * s, color: palette.swampReed, cap: 'round' });
}

/** A Mountain tile's ground: dark rock. Its peak is drawn over everything by `drawRelief`. */
function drawMountainTile(g: Graphics, x: number, y: number): void {
  g.poly(flat(diamond(x, y))).fill(palette.mountainDark);
}

/** A Pass snow tile: white, with a drift heaped across it. */
function drawSnowTile(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  g.poly(flat(diamond(x, y))).fill(palette.snow);
  const c = gridToWorld(x + 0.5, y + 0.5);
  const v = tileVariant(x, y, 3);
  g.ellipse(c.x - 8 * s + v * 6 * s, c.y - 3 * s, 24 * s, 8 * s)
    .fill(palette.snowShade)
    .stroke({ ...THIN_INK, width: 1.5 });
  g.ellipse(c.x - 10 * s + v * 6 * s, c.y - 6 * s, 16 * s, 5 * s).fill(palette.snow);
}

/**
 * The faint grid lines along `chunk`'s tiles: each chunk draws the lines along its north and west
 * sides and those between its tiles; the chunks on the map's south and east edges add the edge.
 */
export function drawGridLines(g: Graphics, chunk: TileChunk, width: number, height: number): void {
  g.clear();
  const x1 = chunk.x + chunk.w;
  const y1 = chunk.y + chunk.h;
  for (let i = chunk.x; i <= (x1 === width ? x1 : x1 - 1); i++) {
    const a = gridToWorld(i, chunk.y);
    const b = gridToWorld(i, y1);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  for (let j = chunk.y; j <= (y1 === height ? y1 : y1 - 1); j++) {
    const a = gridToWorld(chunk.x, j);
    const b = gridToWorld(x1, j);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  g.stroke({ width: 1, color: palette.meadowLine, alpha: 0.35 });
}

/**
 * River and Ford tiles in `chunk`: flat water, a Ford paler and shallow with stepping stones; or,
 * frozen, ice with a crack across each tile (a Ford's stones still show).
 */
export function drawWater(g: Graphics, chunk: TileChunk, map: GroundMap): void {
  g.clear();
  let any = false;
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      const t = terrainAt(map, x, y);
      if (t !== 'river' && t !== 'ford') continue;
      const water = t === 'ford' ? palette.ford : palette.river;
      g.poly(flat(diamond(x, y))).fill(map.frozen ? palette.ice : water);
      any = true;
    }
  }
  if (!any) return;
  const s = TILE_H / 64;
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      if (terrainAt(map, x, y) !== 'ford') continue;
      if (!map.frozen) {
        // Ripples where the water runs over the shallows.
        for (const t of [0.3, 0.7]) {
          const a = gridToWorld(x + 0.15, y + t);
          const b = gridToWorld(x + 0.85, y + t);
          g.moveTo(a.x, a.y).lineTo(b.x, b.y);
        }
        g.stroke({ width: 1.5, color: palette.fordRipple, alpha: 0.7 });
      }
      for (const [sx, sy] of [
        [0.3, 0.5],
        [0.55, 0.3],
        [0.7, 0.7],
      ]) {
        const p = gridToWorld(x + (sx ?? 0), y + (sy ?? 0));
        g.ellipse(p.x, p.y, 6 * s, 3.5 * s)
          .fill(palette.stone)
          .stroke({ ...THIN_INK, width: 1.5 });
      }
    }
  }
  if (!map.frozen) return;
  // A crack across each ice tile, bent differently tile to tile so the sheet doesn't look tiled.
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      if (terrainAt(map, x, y) !== 'river') continue;
      const bend = ((x * 7 + y * 3) % 5) / 10 + 0.3;
      const a = gridToWorld(x + 0.2, y + bend);
      const b = gridToWorld(x + 0.5, y + 1 - bend);
      const c = gridToWorld(x + 0.8, y + 0.5);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y);
    }
  }
  g.stroke({ width: 1.5, color: palette.iceCrack, alpha: 0.8 });
}

/**
 * An ink edge on every side of a tile in `chunk` that meets a lower terrain group on the map
 * (`EDGE_GROUP`): the river's banks, and the foot of Mountains and Pass snow. Off the map gets
 * the map's own outline instead.
 */
export function drawEdges(g: Graphics, chunk: TileChunk, map: GroundMap): void {
  g.clear();
  let any = false;
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      const t = terrainAt(map, x, y);
      if (t === undefined || EDGE_GROUP[t] === 0) continue;
      const group = EDGE_GROUP[t];
      const [top, right, bottom, left] = diamond(x, y);
      const sides: [TerrainId | undefined, Vec, Vec][] = [
        [terrainAt(map, x, y - 1), top, right],
        [terrainAt(map, x + 1, y), right, bottom],
        [terrainAt(map, x, y + 1), bottom, left],
        [terrainAt(map, x - 1, y), left, top],
      ];
      for (const [next, a, b] of sides) {
        if (next === undefined || EDGE_GROUP[next] >= group) continue;
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
        any = true;
      }
    }
  }
  if (any) g.stroke(INK);
}

/** The ink outline round the whole map, over everything else on the ground. */
export function drawMapOutline(g: Graphics, width: number, height: number): void {
  g.clear();
  g.poly(flat(diamond(0, 0, width, height))).stroke(INK);
}

/** Peaks taller than this, in tile heights, are high enough to be lighter, cooler rock. */
const HIGH_PEAK = 1;
/** Peaks taller than this, in tile heights, wear snow. */
const SNOW_LINE = 1.2;

/**
 * The Mountains' relief over `chunk`, the last ground layer: a peak rising from each Mountain
 * tile as high as `heights` says (in tile heights, row-major, from `mountainRelief`), drawn row
 * by row so nearer peaks overlap those behind. Chunks drawn in the order they're laid out
 * (`GroundLayer`) overlap rightly too, since a peak stays inside its tile's width.
 */
export function drawRelief(
  g: Graphics,
  chunk: TileChunk,
  map: GroundMap,
  heights: ArrayLike<number>,
): void {
  g.clear();
  for (let y = chunk.y; y < chunk.y + chunk.h; y++) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      const rise = heights[y * map.width + x] ?? 0;
      if (rise > 0) drawPeak(g, x, y, rise);
    }
  }
}

/**
 * One Mountain tile's peak, `rise` tile heights tall: a lit west face and a shaded east one
 * from the tile's side corners up to a summit near its middle; some tiles carry a ridge of two
 * summits instead. Higher peaks are paler, the highest snow-capped. Where the summit stands and
 * which tiles are ridges come from a hash of the tile.
 */
function drawPeak(g: Graphics, x: number, y: number, rise: number): void {
  const [, right, bottom, left] = diamond(x, y);
  const v = tileHash(x, y, 10);
  const c = gridToWorld(x + 0.5, y + 0.5);
  const h = rise * TILE_H;
  const high = rise > HIGH_PEAK;
  const lit = high ? palette.mountainHighLight : palette.mountainLight;
  const shade = high ? palette.mountainHigh : palette.mountain;
  // The summit stands up to a sixth of the tile either side of the middle.
  const lean = (((v & 7) - 3.5) / 3.5) * (TILE_W / 6);
  const apex = { x: c.x + lean, y: c.y - h };
  const ridge = rise > 0.6 && (v >>> 3) % 3 === 0;
  if (ridge) {
    // Two summits, the west one higher, with a saddle between.
    const west = { x: c.x - TILE_W * 0.2, y: c.y - h };
    const east = { x: c.x + TILE_W * 0.18, y: c.y - h * 0.8 };
    const saddle = { x: c.x, y: c.y - h * 0.58 };
    g.poly(flat([left, west, saddle, bottom])).fill(lit);
    g.poly(flat([saddle, east, right, bottom])).fill(shade);
    g.poly(flat([west, saddle, lerp(saddle, bottom, 0.45)])).fill(shade);
    drawFaceLines(g, left, west, bottom, right, east);
    if (rise > SNOW_LINE) drawSnowCap(g, west, left, lerp(west, saddle, 0.7), 0.32);
    g.poly(flat([left, west, saddle, east, right]), false).stroke(INK);
    g.moveTo(saddle.x, saddle.y).lineTo(bottom.x, bottom.y).stroke(THIN_INK);
  } else {
    g.poly(flat([left, apex, bottom])).fill(lit);
    g.poly(flat([apex, right, bottom])).fill(shade);
    drawFaceLines(g, left, apex, bottom, right, apex);
    if (rise > SNOW_LINE) drawSnowCap(g, apex, left, right, 0.32);
    g.poly(flat([left, apex, right]), false).stroke(INK);
    g.moveTo(apex.x, apex.y).lineTo(bottom.x, bottom.y).stroke(THIN_INK);
  }
  // The foot along the front, where the peak meets the ground or the peaks before it.
  g.poly(flat([left, bottom, right]), false).stroke({ ...THIN_INK, alpha: 0.7 });
}

/** A gully down each face of a peak, in the dark of the rock, so the faces read as stone. */
function drawFaceLines(
  g: Graphics,
  left: Vec,
  west: Vec,
  bottom: Vec,
  right: Vec,
  east: Vec,
): void {
  const a = lerp(west, left, 0.35);
  g.moveTo(a.x, a.y).lineTo(lerp(a, bottom, 0.5).x, lerp(a, bottom, 0.5).y + 2);
  const b = lerp(east, right, 0.45);
  g.moveTo(b.x, b.y).lineTo(lerp(b, bottom, 0.4).x, lerp(b, bottom, 0.4).y);
  g.stroke({ width: 2, color: palette.mountainDark, cap: 'round', alpha: 0.8 });
}

/**
 * Snow over a summit: down `depth` of the way toward `left` and `right`, its lower edge ragged,
 * the east half in shadow.
 */
function drawSnowCap(g: Graphics, apex: Vec, left: Vec, right: Vec, depth: number): void {
  const l = lerp(apex, left, depth);
  const r = lerp(apex, right, depth);
  const below = (t: number, drop: number): Vec => ({
    x: l.x + (r.x - l.x) * t,
    y: l.y + (r.y - l.y) * t + drop,
  });
  const cap = [apex, l, below(0.3, 5), below(0.5, -1), below(0.72, 6), r];
  g.poly(flat(cap)).fill(palette.snow);
  g.poly(flat([apex, below(0.5, -1), below(0.72, 6), r])).fill(palette.snowShade);
  g.poly(flat(cap)).stroke({ ...THIN_INK, width: 1.5 });
}

function groundShadow(g: Graphics, rx: number, ry: number): void {
  groundShadowAt(g, 0, 0, rx, ry);
}

/** A soft shadow on the ground centred on (x, y). */
export function groundShadowAt(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry).fill({ color: palette.shadow, alpha: 0.35 });
}

/** A crown's three shades: dark (shaded side), mid, light (top, lit). */
type Tones = readonly [number, number, number];

/** Each species' crown shades, picked by a tree's `shade` (`TreeLook`). */
const TREE_TONES: Record<TreeSpecies, readonly [Tones, Tones, Tones]> = {
  oak: [
    [palette.canopyDark, palette.canopy, palette.canopyLight],
    [palette.oakDeepDark, palette.oakDeep, palette.oakDeepLight],
    [palette.oakOliveDark, palette.oakOlive, palette.oakOliveLight],
  ],
  pine: [
    [palette.pineDark, palette.pine, palette.pineLight],
    [palette.pineBlueDark, palette.pineBlue, palette.pineBlueLight],
    [palette.pineMossDark, palette.pineMoss, palette.pineMossLight],
  ],
  birch: [
    [palette.birchDark, palette.birch, palette.birchLight],
    [palette.birchGoldDark, palette.birchGold, palette.birchGoldLight],
    [palette.birchPaleDark, palette.birchPale, palette.birchPaleLight],
  ],
};

/** Each species' bark: a trunk, and the side of a Stump. */
const BARK: Record<TreeSpecies, number> = {
  oak: palette.trunk,
  pine: palette.pineBark,
  birch: palette.birchBark,
};

function tonesOf(look: TreeLook): Tones {
  return TREE_TONES[look.species][look.shade] ?? TREE_TONES[look.species][0];
}

/**
 * A tree, drawn around (0, 0) = the centre of its tile on the ground, as `look` says: its
 * species (an oak's round crown, a pine's tiers, a birch's pale trunk and airy crown), size, lean,
 * shade and shape. A thinned tree (`amount` below `fullAmount`) has a smaller crown. Map objects
 * add to `g` without clearing it, so a row of them can share one Graphics (see
 * `mapObjectRuns.ts`).
 */
export function drawTree(
  g: Graphics,
  look: TreeLook,
  amount: number,
  fullAmount: number,
  marked = false,
): void {
  const s = (TILE_H / 64) * look.size; // art scale
  const fullness = 0.75 + 0.25 * (amount / fullAmount);
  const lean = look.lean * 5 * s;
  let crownTop: number;
  if (look.species === 'pine') crownTop = drawPine(g, s, lean, look, fullness);
  else if (look.species === 'birch') crownTop = drawBirch(g, s, lean, look, fullness);
  else crownTop = drawOak(g, s, lean, look, fullness);
  // Marked to fell: a pennant above the crown, seen over the trees in front.
  if (marked) drawPennant(g, s, lean + 2 * s, crownTop + 14 * s, crownTop - 16 * s);
}

/** A trunk from ±`base` wide on the ground up to ±`top` wide at `height`, its top moved by `lean`. */
function drawTrunk(
  g: Graphics,
  base: number,
  top: number,
  height: number,
  lean: number,
  bark: number,
): void {
  g.poly(
    flat([
      { x: -base, y: 0 },
      { x: lean - top, y: -height },
      { x: lean + top, y: -height },
      { x: base, y: 0 },
    ]),
  )
    .fill(bark)
    .stroke(INK);
}

/**
 * Where an oak's crown blobs sit, per `shape`: x, y and radius (in art units, before the crown's
 * fullness) and which shade (`Tones` index), back to front. The plain one; a broad, flat one; a
 * tall one; a lopsided one.
 */
const OAK_CROWNS: readonly (readonly [number, number, number, number])[][] = [
  [
    [-15, -46, 22, 0],
    [15, -48, 22, 1],
    [0, -66, 25, 2],
  ],
  [
    [-20, -44, 20, 0],
    [20, -45, 20, 1],
    [-8, -61, 21, 1],
    [9, -63, 21, 2],
  ],
  [
    [-12, -50, 19, 0],
    [12, -54, 19, 1],
    [0, -74, 22, 2],
  ],
  [
    [15, -44, 21, 0],
    [-14, -50, 22, 1],
    [4, -68, 24, 2],
  ],
];

/** An oak: a stout trunk under a crown of round blobs. Returns the crown's top. */
function drawOak(g: Graphics, s: number, lean: number, look: TreeLook, fullness: number): number {
  const tones = tonesOf(look);
  groundShadow(g, 30 * s, 14 * s);
  drawTrunk(g, 7 * s, 5 * s, 38 * s, lean * 0.6, BARK.oak);
  const crown = OAK_CROWNS[look.shape] ?? OAK_CROWNS[0] ?? [];
  let top = 0;
  for (const [x, y, r, tone] of crown) {
    const radius = r * s * fullness;
    g.circle(lean + x * s, y * s, radius)
      .fill(tones[tone] ?? tones[1])
      .stroke(INK);
    top = Math.min(top, y * s - radius);
  }
  // A few leaf strokes for texture.
  g.moveTo(lean - 6 * s, top + 16 * s).lineTo(lean + 2 * s, top + 24 * s);
  g.moveTo(lean + 8 * s, -48 * s).lineTo(lean + 14 * s, -42 * s);
  g.stroke({ ...THIN_INK, alpha: 0.6 });
  return top;
}

/**
 * A pine: a short reddish trunk under three or four tiers of needles, each narrower than the one
 * below, shaded on the east. `shape` picks the tier count (3 or 4) and how broad they spread.
 * Returns the crown's top.
 */
function drawPine(g: Graphics, s: number, lean: number, look: TreeLook, fullness: number): number {
  const tones = tonesOf(look);
  const tiers = look.shape < 2 ? 3 : 4;
  const broad = look.shape % 2 === 1 ? 1.15 : 1;
  groundShadow(g, 24 * s * broad, 11 * s);
  drawTrunk(g, 5 * s, 3.5 * s, 24 * s, lean * 0.2, BARK.pine);
  const tip = -(96 + (tiers - 3) * 10) * s;
  const bottom = -14 * s;
  // Each tier's base climbs evenly from `bottom`; each spans 40% of the whole height.
  const span = (tip - bottom) * 0.42;
  let top = 0;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const base = bottom + (tip - bottom - span) * (i / (tiers - 1));
    const peak = base + span;
    const half = (27 - 14 * t) * s * broad * fullness;
    const shift = lean * (0.3 + 0.7 * ((i + 1) / tiers));
    const left = { x: shift - half, y: base };
    const right = { x: shift + half, y: base };
    const sag = { x: shift, y: base + 5 * s };
    const apex = { x: lean * (0.3 + 0.7 * ((i + 1.4) / tiers)), y: peak };
    g.poly(flat([left, apex, right, sag])).fill(tones[1]);
    g.poly(flat([apex, right, sag])).fill(tones[0]);
    // A lit fringe along the west slope.
    g.poly(flat([apex, left, lerp(left, sag, 0.35), lerp(apex, sag, 0.25)])).fill(tones[2]);
    g.poly(flat([left, apex, right, sag])).stroke(INK);
    top = Math.min(top, peak);
  }
  return top;
}

/**
 * A birch: a slender pale trunk streaked dark, rising into a loose crown of small ovals that
 * lets the trunk show beneath. `shape` picks the crown's layout and, for 2 and 3, a forked branch.
 * Returns the crown's top.
 */
function drawBirch(g: Graphics, s: number, lean: number, look: TreeLook, fullness: number): number {
  const tones = tonesOf(look);
  groundShadow(g, 22 * s, 10 * s);
  drawTrunk(g, 4 * s, 2.5 * s, 70 * s, lean, BARK.birch);
  // The shaded east side of the trunk.
  g.poly(
    flat([
      { x: 1.5 * s, y: -1 * s },
      { x: lean + 1 * s, y: -68 * s },
      { x: lean + 2.5 * s, y: -68 * s },
      { x: 4 * s, y: -1 * s },
    ]),
  ).fill(palette.birchBarkShade);
  if (look.shape >= 2) {
    const side = look.shape === 2 ? -1 : 1;
    const from = { x: lean * 0.55, y: -38 * s };
    const to = { x: lean * 0.8 + side * 13 * s, y: -56 * s };
    g.moveTo(from.x, from.y)
      .lineTo(to.x, to.y)
      .stroke({ width: 5 * s, color: palette.ink, cap: 'round' });
    g.moveTo(from.x, from.y)
      .lineTo(to.x, to.y)
      .stroke({ width: 2.5 * s, color: palette.birchBark, cap: 'round' });
  }
  // The dark streaks across the bark.
  for (const [y, w] of [
    [-9, 3],
    [-19, 2],
    [-28, 3],
    [-39, 2],
  ] as const) {
    const x = lean * (-y / 70);
    g.moveTo(x - w * s, y * s).lineTo(x + w * 0.4 * s, (y - 1) * s);
  }
  g.stroke({ width: 2 * s, color: palette.ink, cap: 'round' });
  const crown = BIRCH_CROWNS[look.shape] ?? BIRCH_CROWNS[0] ?? [];
  let top = 0;
  for (const [x, y, rx, ry, tone] of crown) {
    const w = rx * s * fullness;
    const h = ry * s * fullness;
    g.ellipse(lean + x * s, y * s, w, h)
      .fill(tones[tone] ?? tones[1])
      .stroke(INK);
    top = Math.min(top, y * s - h);
  }
  // Hanging twigs under the crown.
  g.moveTo(lean - 9 * s, -50 * s).lineTo(lean - 11 * s, -42 * s);
  g.moveTo(lean + 10 * s, -52 * s).lineTo(lean + 12 * s, -45 * s);
  g.stroke({ ...THIN_INK, alpha: 0.7 });
  return top;
}

/**
 * Where a birch's crown ovals sit, per `shape`: x, y, the two radii (art units, before fullness)
 * and which shade, back to front.
 */
const BIRCH_CROWNS: readonly (readonly [number, number, number, number, number])[][] = [
  [
    [-11, -62, 13, 15, 0],
    [11, -66, 13, 15, 1],
    [0, -82, 13, 16, 2],
  ],
  [
    [-13, -58, 12, 13, 0],
    [12, -60, 12, 13, 0],
    [-4, -72, 13, 13, 1],
    [6, -86, 11, 13, 2],
  ],
  [
    [10, -62, 12, 14, 0],
    [-12, -66, 12, 15, 1],
    [-2, -80, 13, 16, 2],
  ],
  [
    [-10, -60, 12, 14, 0],
    [12, -64, 12, 14, 1],
    [1, -84, 12, 17, 2],
  ],
];

/**
 * A mark's pennant: a stick from (x, `foot`) up to (x, `top`) flying a flag of paint-coloured
 * cloth. `s` is the art scale.
 */
function drawPennant(g: Graphics, s: number, x: number, foot: number, top: number): void {
  g.moveTo(x, foot)
    .lineTo(x, top)
    .stroke({ width: 3.5 * s, color: palette.ink, cap: 'round' });
  g.moveTo(x, foot)
    .lineTo(x, top)
    .stroke({ width: 1.8 * s, color: palette.log, cap: 'round' });
  g.poly(
    flat([
      { x, y: top },
      { x: x + 11 * s, y: top + 4 * s },
      { x, y: top + 8 * s },
    ]),
  )
    .fill(palette.mark)
    .stroke(THIN_INK);
}

/**
 * A Stump, what a felled tree leaves: a short cut log end in its species' bark (a birch's
 * streaked), pale on top, with a root or two; with a pennant staked beside it when `marked` to be
 * dug out.
 */
export function drawStump(g: Graphics, species: TreeSpecies, marked = false): void {
  const s = TILE_H / 64;
  const bark = BARK[species];
  groundShadow(g, 12 * s, 6 * s);
  g.moveTo(-7 * s, -2 * s)
    .quadraticCurveTo(-11 * s, 1 * s, -13 * s, 3 * s)
    .moveTo(6 * s, -1 * s)
    .quadraticCurveTo(10 * s, 2 * s, 12 * s, 2 * s)
    .stroke({ width: 3 * s, color: palette.ink, cap: 'round' });
  g.moveTo(-7 * s, -2 * s)
    .quadraticCurveTo(-11 * s, 1 * s, -13 * s, 3 * s)
    .moveTo(6 * s, -1 * s)
    .quadraticCurveTo(10 * s, 2 * s, 12 * s, 2 * s)
    .stroke({ width: 1.5 * s, color: bark, cap: 'round' });
  // The side, round at the bottom like the cut top.
  g.moveTo(-7 * s, -9 * s)
    .lineTo(7 * s, -9 * s)
    .lineTo(7 * s, 0)
    .quadraticCurveTo(0, 6 * s, -7 * s, 0)
    .closePath()
    .fill(bark)
    .stroke(INK);
  if (species === 'birch') {
    g.moveTo(-5 * s, -4 * s).lineTo(-1 * s, -5 * s);
    g.moveTo(2 * s, -1 * s).lineTo(5 * s, -2 * s);
    g.stroke({ width: 1.8 * s, color: palette.ink, cap: 'round' });
  }
  g.ellipse(0, -9 * s, 7 * s, 3 * s)
    .fill(palette.log)
    .stroke(INK);
  g.ellipse(0, -9 * s, 3.5 * s, 1.5 * s).stroke({ ...THIN_INK, alpha: 0.6 });
  if (marked) drawPennant(g, s, 11 * s, 3 * s, -20 * s);
}

/**
 * A Sapling, drawn like `drawTree` but small and in its species' look, taller at each `stage`
 * (0 a shoot, 1 a whip with a tuft, 2 a young tree with a thin crown). It stands in a ring of
 * turned earth.
 */
export function drawSapling(g: Graphics, stage: number, species: TreeSpecies): void {
  const s = TILE_H / 64;
  const [dark, mid, light] = TREE_TONES[species][0];
  const bark = BARK[species];
  g.ellipse(0, 0, 10 * s, 5 * s)
    .fill(palette.dirt)
    .stroke(THIN_INK);
  if (stage <= 0) {
    g.moveTo(0, 0)
      .lineTo(0, -12 * s)
      .stroke({ width: 2.5 * s, color: palette.ink });
    g.moveTo(0, 0)
      .lineTo(0, -12 * s)
      .stroke({ width: 1.2 * s, color: bark });
    if (species === 'pine') {
      g.poly(
        flat([
          { x: -4 * s, y: -9 * s },
          { x: 0, y: -19 * s },
          { x: 4 * s, y: -9 * s },
        ]),
      )
        .fill(mid)
        .stroke(THIN_INK);
      return;
    }
    g.ellipse(-4 * s, -12 * s, 4 * s, 2.2 * s)
      .fill(light)
      .stroke(THIN_INK);
    g.ellipse(4 * s, -14 * s, 4 * s, 2.2 * s)
      .fill(mid)
      .stroke(THIN_INK);
    return;
  }
  const height = stage === 1 ? 20 : 28;
  const r = stage === 1 ? 7 : 11;
  groundShadow(g, (r + 6) * s, (r / 2 + 3) * s);
  if (species === 'pine') {
    // A trunk stub under one tier, or two.
    g.poly(
      flat([
        { x: -2 * s, y: 0 },
        { x: -1.5 * s, y: -8 * s },
        { x: 1.5 * s, y: -8 * s },
        { x: 2 * s, y: 0 },
      ]),
    )
      .fill(bark)
      .stroke(THIN_INK);
    const tiers = stage === 1 ? 1 : 2;
    for (let i = 0; i < tiers; i++) {
      const base = -(6 + i * 10) * s;
      const half = (r + 2 - i * 4) * s;
      const tip = base - (stage === 1 ? 16 : 18) * s;
      g.poly(
        flat([
          { x: -half, y: base },
          { x: 0, y: tip },
          { x: half, y: base },
        ]),
      )
        .fill(i === tiers - 1 ? mid : dark)
        .stroke(INK);
    }
    return;
  }
  g.poly(
    flat([
      { x: -2 * s, y: 0 },
      { x: -1.5 * s, y: -height * s },
      { x: 1.5 * s, y: -height * s },
      { x: 2 * s, y: 0 },
    ]),
  )
    .fill(bark)
    .stroke(THIN_INK);
  if (species === 'birch') {
    g.ellipse(0, -(height + r * 0.6) * s, r * 0.8 * s, r * 1.1 * s)
      .fill(light)
      .stroke(INK);
    return;
  }
  if (stage >= 2) {
    g.circle(-6 * s, -(height + 2) * s, r * 0.8 * s)
      .fill(dark)
      .stroke(INK);
    g.circle(6 * s, -(height + 3) * s, r * 0.8 * s)
      .fill(mid)
      .stroke(INK);
  }
  g.circle(0, -(height + r * 0.6) * s, r * s)
    .fill(light)
    .stroke(INK);
}

/** A berry bush, drawn like `drawTree`: berries while it has some, bare and dry once withered. */
export function drawBerryBush(g: Graphics, amount: number, withered: boolean): void {
  const s = TILE_H / 64;
  groundShadow(g, 26 * s, 11 * s);
  const dark = withered ? palette.witheredDark : palette.bush;
  const light = withered ? palette.withered : palette.bushLight;
  g.ellipse(-10 * s, -12 * s, 16 * s, 13 * s)
    .fill(dark)
    .stroke(INK);
  g.ellipse(10 * s, -13 * s, 16 * s, 13 * s)
    .fill(dark)
    .stroke(INK);
  g.ellipse(0, -24 * s, 17 * s, 13 * s)
    .fill(light)
    .stroke(INK);
  if (withered) {
    // Dead twigs poking out.
    g.moveTo(-4 * s, -30 * s).lineTo(-10 * s, -40 * s);
    g.moveTo(6 * s, -28 * s).lineTo(12 * s, -37 * s);
    g.stroke(THIN_INK);
    return;
  }
  const spots = [
    [-12, -14],
    [8, -26],
    [12, -12],
    [-4, -28],
    [-18, -8],
    [2, -16],
    [18, -18],
    [-10, -24],
  ];
  for (const [x, y] of spots.slice(0, Math.min(amount, spots.length))) {
    drawBerry(g, (x ?? 0) * s, (y ?? 0) * s, s);
  }
}

/** A mushroom patch, drawn like `drawTree`: caps while it has some, bare dry litter otherwise. */
export function drawMushroomPatch(g: Graphics, amount: number, withered: boolean): void {
  const s = TILE_H / 64;
  g.ellipse(0, 0, 30 * s, 13 * s)
    .fill(withered ? palette.withered : palette.litter)
    .stroke(THIN_INK);
  if (withered) return;
  const spots = [
    [-10, -2],
    [8, 2],
    [0, -6],
    [16, -3],
    [-18, 2],
    [-2, 5],
  ];
  for (const [x, y] of spots.slice(0, Math.min(amount, spots.length))) {
    drawMushroom(g, (x ?? 0) * s, (y ?? 0) * s, s);
  }
}

/** A stone Deposit, drawn like `drawTree`: grey boulders, or a quarried hollow once dug out. */
export function drawStoneDeposit(g: Graphics, dugOut: boolean): void {
  const s = TILE_H / 64;
  if (dugOut) {
    drawDugHollow(g, palette.stoneDark);
    for (const [x, y, r] of [
      [-12, -1, 3],
      [9, 2, 2.5],
      [14, -3, 2],
    ] as const) {
      g.circle(x * s, y * s, r * s)
        .fill(palette.stone)
        .stroke(THIN_INK);
    }
    return;
  }
  groundShadow(g, 28 * s, 12 * s);
  g.ellipse(-11 * s, -7 * s, 14 * s, 10 * s)
    .fill(palette.stoneDark)
    .stroke(INK);
  g.ellipse(12 * s, -6 * s, 12 * s, 9 * s)
    .fill(palette.stoneDark)
    .stroke(INK);
  g.ellipse(0, -16 * s, 15 * s, 12 * s)
    .fill(palette.stone)
    .stroke(INK);
  g.moveTo(-5 * s, -20 * s).lineTo(3 * s, -14 * s);
  g.moveTo(8 * s, -8 * s).lineTo(14 * s, -4 * s);
  g.stroke({ ...THIN_INK, alpha: 0.6 });
}

/** A clay Deposit, drawn like `drawTree`: a dug, wet bank of red clay, or a bare pit once dug out. */
export function drawClayDeposit(g: Graphics, dugOut: boolean): void {
  const s = TILE_H / 64;
  if (dugOut) {
    drawDugHollow(g, palette.clayDark);
    g.ellipse(-2 * s, 1 * s, 8 * s, 2.5 * s).fill(palette.clayWet);
    return;
  }
  g.ellipse(0, 0, 28 * s, 12 * s)
    .fill(palette.clayDark)
    .stroke(INK);
  g.ellipse(-4 * s, -4 * s, 18 * s, 7 * s).fill(palette.clay);
  g.ellipse(-8 * s, -6 * s, 6 * s, 2.5 * s).fill(palette.clayWet);
  g.ellipse(9 * s, 1 * s, 4 * s, 1.8 * s).fill(palette.clayWet);
}

/**
 * An iron Deposit, drawn like `drawTree`: a dark outcrop on the Mountain, streaked with rust; once
 * dug out, a low stump of rock round a dark hollow.
 */
export function drawIronDeposit(g: Graphics, dugOut: boolean): void {
  const s = TILE_H / 64;
  if (dugOut) {
    g.poly(
      flat([
        { x: -22 * s, y: 2 * s },
        { x: -16 * s, y: -8 * s },
        { x: 14 * s, y: -8 * s },
        { x: 22 * s, y: 0 },
        { x: 4 * s, y: 8 * s },
      ]),
    )
      .fill(palette.ironOre)
      .stroke(INK);
    g.ellipse(0, -1 * s, 11 * s, 4.5 * s)
      .fill(palette.ink)
      .stroke(THIN_INK);
    return;
  }
  g.poly(
    flat([
      { x: -22 * s, y: 2 * s },
      { x: -14 * s, y: -18 * s },
      { x: -2 * s, y: -26 * s },
      { x: 12 * s, y: -20 * s },
      { x: 22 * s, y: 0 },
      { x: 4 * s, y: 8 * s },
    ]),
  )
    .fill(palette.ironOre)
    .stroke(INK);
  for (const [x, y, r] of [
    [-10, -8, 4],
    [6, -14, 3.5],
    [10, -2, 3],
    [-3, -18, 2.5],
  ]) {
    g.circle((x ?? 0) * s, (y ?? 0) * s, (r ?? 0) * s).fill(palette.rust);
  }
}

/** A dug-out Deposit's hollow: a dished pit in `rim`, its floor in shadow. */
function drawDugHollow(g: Graphics, rim: number): void {
  const s = TILE_H / 64;
  g.ellipse(0, 0, 26 * s, 11 * s)
    .fill(rim)
    .stroke(INK);
  g.ellipse(0, 1 * s, 17 * s, 6.5 * s).fill(palette.dirtDark);
}

/** One berry, centred on (x, y). */
function drawBerry(g: Graphics, x: number, y: number, s: number): void {
  g.circle(x, y, 3.5 * s)
    .fill(palette.berry)
    .stroke({ ...THIN_INK, width: 1.5 });
  g.circle(x - 1 * s, y - 1.2 * s, 1 * s).fill(palette.berryShine);
}

/** A cluster of three berries, centred on (x, y). */
function drawBerries(g: Graphics, x: number, y: number, s: number): void {
  drawBerry(g, x - 3.5 * s, y + 1 * s, s);
  drawBerry(g, x + 3.5 * s, y + 1 * s, s);
  drawBerry(g, x, y - 3 * s, s);
}

/** One mushroom standing with its foot on (x, y). */
function drawMushroom(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - 2 * s, y - 7 * s, 4 * s, 8 * s, 1.5 * s)
    .fill(palette.mushroomStem)
    .stroke({ ...THIN_INK, width: 1.5 });
  g.ellipse(x, y - 8 * s, 7 * s, 4 * s)
    .fill(palette.mushroomCap)
    .stroke({ ...THIN_INK, width: 1.5 });
}

/** One log lying on the ground or on a stack, centred on (x, y). */
function drawLog(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - 11 * s, y - 4 * s, 22 * s, 8 * s, 4 * s)
    .fill(palette.log)
    .stroke(THIN_INK);
  g.circle(x + 10 * s, y, 4 * s)
    .fill(palette.logEnd)
    .stroke(THIN_INK);
}

/** One piece of split firewood lying on its side, centred on (x, y): a short log, wedge-ended. */
function drawFirewood(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - 8 * s, y - 3.5 * s, 16 * s, 7 * s, 2 * s)
    .fill(palette.firewood)
    .stroke(THIN_INK);
  g.poly([x + 4 * s, y + 3.5 * s, x + 10 * s, y + 3.5 * s, x + 7 * s, y - 3.5 * s])
    .fill(palette.firewoodEnd)
    .stroke(THIN_INK);
}

/** One fish lying on its side, centred on (x, y), head to the right. */
function drawFish(g: Graphics, x: number, y: number, s: number): void {
  g.poly([x - 11 * s, y - 4 * s, x - 6 * s, y, x - 11 * s, y + 4 * s])
    .fill(palette.fish)
    .stroke(THIN_INK);
  g.ellipse(x + 2 * s, y, 9 * s, 4 * s)
    .fill(palette.fish)
    .stroke(THIN_INK);
  g.ellipse(x + 2 * s, y + 1.5 * s, 6 * s, 1.5 * s).fill(palette.fishBelly);
  g.circle(x + 7 * s, y - 1 * s, 1 * s).fill(palette.ink);
}

/** One haunch of meat lying on its side, centred on (x, y), bone to the right. */
function drawMeat(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x + 3 * s, y - 1.5 * s, 8 * s, 3 * s, 1.5 * s)
    .fill(palette.bone)
    .stroke({ ...THIN_INK, width: 1.5 });
  g.circle(x + 11 * s, y, 2.5 * s)
    .fill(palette.bone)
    .stroke({ ...THIN_INK, width: 1.5 });
  g.ellipse(x - 3 * s, y, 8 * s, 5 * s)
    .fill(palette.meat)
    .stroke(THIN_INK);
  g.ellipse(x - 4 * s, y - 1.5 * s, 4 * s, 1.5 * s).fill(palette.meatFat);
}

/** One folded hide, centred on (x, y): a rough, flat pelt with a darker fold. */
function drawHide(g: Graphics, x: number, y: number, s: number): void {
  g.poly([
    x - 10 * s,
    y - 2 * s,
    x - 6 * s,
    y - 4.5 * s,
    x + 6 * s,
    y - 4 * s,
    x + 10 * s,
    y - 1 * s,
    x + 8 * s,
    y + 3.5 * s,
    x - 8 * s,
    y + 3.5 * s,
  ])
    .fill(palette.hide)
    .stroke(THIN_INK);
  g.moveTo(x - 7 * s, y + 0.5 * s)
    .lineTo(x + 7 * s, y + 0.5 * s)
    .stroke({ width: 1.5 * s, color: palette.hideDark, cap: 'round' });
}

/** One block of stone, centred on (x, y). */
function drawStone(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - 8 * s, y - 4 * s, 16 * s, 8 * s, 1.5 * s)
    .fill(palette.stone)
    .stroke(THIN_INK);
  g.moveTo(x - 3 * s, y - 4 * s)
    .lineTo(x - 1 * s, y + 4 * s)
    .stroke({ width: 1.2 * s, color: palette.stoneDark });
}

/** One lump of clay, centred on (x, y). */
function drawClay(g: Graphics, x: number, y: number, s: number): void {
  g.ellipse(x, y, 8 * s, 4.5 * s)
    .fill(palette.clay)
    .stroke(THIN_INK);
  g.ellipse(x - 2.5 * s, y - 1.5 * s, 3 * s, 1.2 * s).fill(palette.clayWet);
}

/** One sheaf of grain, lying on its side, centred on (x, y): stalks tied in the middle. */
function drawGrain(g: Graphics, x: number, y: number, s: number): void {
  g.poly([
    x - 9 * s,
    y - 3 * s,
    x + 9 * s,
    y - 4.5 * s,
    x + 9 * s,
    y + 3.5 * s,
    x - 9 * s,
    y + 3 * s,
  ])
    .fill(palette.grain)
    .stroke(THIN_INK);
  g.moveTo(x - 6 * s, y)
    .lineTo(x + 6 * s, y - 0.5 * s)
    .stroke({ width: 1 * s, color: palette.grainDark });
  g.rect(x - 1 * s, y - 4.5 * s, 2.5 * s, 8.5 * s).fill(palette.rope);
}

/** One lump of charcoal, centred on (x, y). */
function drawCharcoal(g: Graphics, x: number, y: number, s: number): void {
  g.poly([x - 8 * s, y + 3 * s, x - 6 * s, y - 3 * s, x + 2 * s, y - 4 * s, x + 8 * s, y + 3 * s])
    .fill(palette.charcoal)
    .stroke(THIN_INK);
  g.moveTo(x - 4 * s, y - 2 * s)
    .lineTo(x + 1 * s, y - 2.5 * s)
    .stroke({ width: 1.2 * s, color: palette.charcoalSheen });
}

/** One sawn plank lying flat, centred on (x, y), its grain along it. */
function drawPlank(g: Graphics, x: number, y: number, s: number): void {
  g.rect(x - 11 * s, y - 2.5 * s, 22 * s, 5 * s)
    .fill(palette.plank)
    .stroke(THIN_INK);
  g.moveTo(x - 8 * s, y - 0.5 * s)
    .lineTo(x + 7 * s, y - 0.5 * s)
    .stroke({ width: 1 * s, color: palette.plankDark });
}

/** One squared block of cut stone, centred on (x, y): a pale face under a lighter top. */
function drawCutStone(g: Graphics, x: number, y: number, s: number): void {
  g.rect(x - 7 * s, y - 2 * s, 14 * s, 6 * s)
    .fill(palette.cutStoneDark)
    .stroke(THIN_INK);
  g.poly([x - 7 * s, y - 2 * s, x - 4 * s, y - 5 * s, x + 10 * s, y - 5 * s, x + 7 * s, y - 2 * s])
    .fill(palette.cutStone)
    .stroke(THIN_INK);
}

/** One fired brick, centred on (x, y). */
function drawBrick(g: Graphics, x: number, y: number, s: number): void {
  g.rect(x - 7 * s, y - 2.5 * s, 14 * s, 5 * s)
    .fill(palette.brick)
    .stroke(THIN_INK);
  g.moveTo(x - 5 * s, y + 1 * s)
    .lineTo(x + 5 * s, y + 1 * s)
    .stroke({ width: 1 * s, color: palette.brickDark });
}

/** `draw`'s piece browned in smoke and hung on a loop of string: smoked fish or meat. */
function smoked(draw: (g: Graphics, x: number, y: number, s: number) => void) {
  return (g: Graphics, x: number, y: number, s: number): void => {
    draw(g, x, y, s);
    g.ellipse(x, y, 9 * s, 4 * s).fill({ color: palette.smoked, alpha: 0.55 });
    g.moveTo(x - 6 * s, y - 3 * s)
      .quadraticCurveTo(x - 6 * s, y - 8 * s, x - 2 * s, y - 4 * s)
      .stroke({ width: 1 * s, color: palette.rope });
  };
}

/** One lump of iron ore, centred on (x, y). */
function drawIronOre(g: Graphics, x: number, y: number, s: number): void {
  g.poly([x - 8 * s, y + 3 * s, x - 5 * s, y - 4 * s, x + 4 * s, y - 4.5 * s, x + 8 * s, y + 3 * s])
    .fill(palette.ironOre)
    .stroke(THIN_INK);
  g.circle(x + 1 * s, y - 1 * s, 1.8 * s).fill(palette.rust);
}

/** One iron bar, centred on (x, y): a dark ingot with a lighter top. */
function drawIronBar(g: Graphics, x: number, y: number, s: number): void {
  g.poly([
    x - 8 * s,
    y + 2.5 * s,
    x - 6 * s,
    y - 2.5 * s,
    x + 6 * s,
    y - 2.5 * s,
    x + 8 * s,
    y + 2.5 * s,
  ])
    .fill(palette.ironBar)
    .stroke(THIN_INK);
  g.moveTo(x - 5 * s, y - 1.5 * s)
    .lineTo(x + 5 * s, y - 1.5 * s)
    .stroke({ width: 1 * s, color: palette.ironBarLight });
}

/** One small cask of ale lying on its side, centred on (x, y), its hoops showing. */
function drawAleCask(g: Graphics, x: number, y: number, s: number): void {
  g.ellipse(x, y, 8 * s, 4.5 * s)
    .fill(palette.barrel)
    .stroke(THIN_INK);
  for (const dx of [-4, 4]) {
    g.moveTo(x + dx * s, y - 4 * s)
      .lineTo(x + dx * s, y + 4 * s)
      .stroke({ width: 1.2 * s, color: palette.iron });
  }
  g.circle(x, y, 1.2 * s).fill(palette.ale);
}

/** A hammer lying down, centred on (x, y): a wooden handle and an iron head at its right end. */
function drawTool(g: Graphics, x: number, y: number, s: number): void {
  g.poly([
    x - 8 * s,
    y + 1.5 * s,
    x + 4 * s,
    y - 0.5 * s,
    x + 4 * s,
    y + 1.5 * s,
    x - 8 * s,
    y + 3 * s,
  ])
    .fill(palette.plank)
    .stroke(THIN_INK);
  g.poly([
    x + 3 * s,
    y - 3.5 * s,
    x + 8 * s,
    y - 3.5 * s,
    x + 8 * s,
    y + 3 * s,
    x + 3 * s,
    y + 3 * s,
  ])
    .fill(palette.iron)
    .stroke(THIN_INK);
}

/** How each resource is drawn as one piece, and the spacing of its pieces in a pile. */
const PIECES: Record<
  ResourceId,
  { draw: (g: Graphics, x: number, y: number, s: number) => void; w: number; h: number }
> = {
  logs: { draw: drawLog, w: 20, h: 8 },
  firewood: { draw: drawFirewood, w: 16, h: 7 },
  fish: { draw: drawFish, w: 20, h: 7 },
  berries: { draw: drawBerries, w: 14, h: 8 },
  mushrooms: { draw: (g, x, y, s) => drawMushroom(g, x, y + 4 * s, s), w: 14, h: 9 },
  meat: { draw: drawMeat, w: 20, h: 9 },
  hides: { draw: drawHide, w: 20, h: 7 },
  stone: { draw: drawStone, w: 17, h: 8 },
  clay: { draw: drawClay, w: 17, h: 8 },
  iron_ore: { draw: drawIronOre, w: 17, h: 8 },
  grain: { draw: drawGrain, w: 19, h: 8 },
  charcoal: { draw: drawCharcoal, w: 17, h: 8 },
  planks: { draw: drawPlank, w: 22, h: 6 },
  cut_stone: { draw: drawCutStone, w: 17, h: 8 },
  bricks: { draw: drawBrick, w: 15, h: 6 },
  smoked_fish: { draw: smoked(drawFish), w: 20, h: 8 },
  smoked_meat: { draw: smoked(drawMeat), w: 20, h: 9 },
  iron_bars: { draw: drawIronBar, w: 17, h: 6 },
  ale: { draw: drawAleCask, w: 17, h: 9 },
  tools: { draw: drawTool, w: 18, h: 7 },
};

/** A pyramid of `count` pieces of `resource` whose bottom row is centred on (x, y). */
export function drawGoodsPile(
  g: Graphics,
  resource: ResourceId,
  x: number,
  y: number,
  count: number,
): void {
  const s = TILE_H / 64;
  const piece = PIECES[resource];
  // Smallest triangle that holds them all: rows of k, k-1, ... pieces.
  let bottom = 1;
  while ((bottom * (bottom + 1)) / 2 < count) bottom++;
  let placed = 0;
  for (let row = 0; placed < count; row++) {
    const inRow = bottom - row;
    for (let i = 0; i < inRow && placed < count; i++, placed++) {
      piece.draw(g, x + (i - (inRow - 1) / 2) * piece.w * s, y - row * piece.h * s, s);
    }
  }
}

/** The side of its footprint a building's door tile is on. */
export type DoorFace = 'south' | 'west' | 'north' | 'east';

export function doorFace(layout: BuildingLayout): DoorFace {
  const { origin, size, door } = layout;
  if (door.y >= origin.y + size.h) return 'south';
  if (door.x < origin.x) return 'west';
  if (door.y < origin.y) return 'north';
  return 'east';
}

/** Grid direction out through a wall facing each way. */
const OUTWARD: Record<DoorFace, Vec> = {
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
};

/**
 * Where a building's door is: the wall it's on (`face`), the grid point on the footprint's edge
 * mid-way along the door tile (`sill`), and the grid direction out through it (`out`). Building art
 * draws its door and doorstep from this, so they follow the sim's door tile on every turn.
 */
export interface Doorway {
  face: DoorFace;
  sill: Vec;
  out: Vec;
}

export function doorway(layout: BuildingLayout): Doorway {
  const face = doorFace(layout);
  const out = OUTWARD[face];
  const { door } = layout;
  return {
    face,
    sill: { x: door.x + 0.5 - out.x * 0.5, y: door.y + 0.5 - out.y * 0.5 },
    out: { ...out },
  };
}

/** North and west walls face away from the isometric camera. */
export function isBackFace(face: DoorFace): boolean {
  return face === 'north' || face === 'west';
}

/**
 * A doorstep on the ground at `door`, where a site's or a placement ghost's door will be. Its long
 * side runs along the wall. (A finished building draws its own, `drawDoorstones` in buildingArt.ts.)
 */
export function drawDoorstep(g: Graphics, door: Vec, face: DoorFace): void {
  const along = face === 'north' || face === 'south';
  const w = along ? 0.5 : 0.3;
  const h = along ? 0.3 : 0.5;
  const nearWall: Record<DoorFace, Vec> = {
    south: { x: 0.25, y: 0 },
    north: { x: 0.25, y: 0.7 },
    west: { x: 0.7, y: 0.25 },
    east: { x: 0, y: 0.25 },
  };
  const at = nearWall[face];
  g.poly(flat(diamond(door.x + at.x, door.y + at.y, w, h)))
    .fill(palette.door)
    .stroke(THIN_INK);
}

/**
 * A chopping block: a stump with an axe in it, wood chips where its worker stands at the door and
 * the logs waiting to be split (`input`) behind. Its firewood is in its yard. The axe handle leans
 * towards the door.
 */
export function drawChoppingBlock(
  g: Graphics,
  layout: BuildingLayout,
  input: ResourceAmount | null,
): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin, door } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  // Grid direction from the block to its door; piles sit along it, clear of the stump.
  const dir = { x: door.x - origin.x, y: door.y - origin.y };
  const toward = (t: number): Vec =>
    gridToWorld(origin.x + 0.5 + dir.x * t, origin.y + 0.5 + dir.y * t);
  const pile = input && input.amount > 0 ? { at: toward(-0.42), goods: input } : null;
  const drawPiles = (front: boolean) => {
    if (pile && pile.at.y > c.y === front) {
      drawGoodsPile(g, pile.goods.resource, pile.at.x, pile.at.y, pile.goods.amount);
    }
  };

  drawChips(g, gridToWorld(door.x + 0.5, door.y + 0.5), s);
  drawPiles(false);

  const rx = 16 * s;
  const ry = 7 * s;
  const h = 16 * s;
  g.ellipse(c.x, c.y + 2 * s, rx * 1.3, ry * 1.3).fill({ color: palette.shadow, alpha: 0.3 });
  g.poly([c.x - rx, c.y - h, c.x + rx, c.y - h, c.x + rx, c.y, c.x - rx, c.y])
    .fill(palette.trunk)
    .stroke(INK);
  g.ellipse(c.x, c.y, rx, ry).fill(palette.trunk).stroke(INK);
  g.rect(c.x - rx + 1.5, c.y - h, rx * 2 - 3, h).fill(palette.trunk);
  g.ellipse(c.x, c.y - h, rx, ry)
    .fill(palette.logEnd)
    .stroke(INK);
  g.ellipse(c.x, c.y - h, rx * 0.5, ry * 0.5).stroke(THIN_INK);

  // The axe, bitten into the top, its handle leaning to the door's side of the screen.
  const side = toward(1).x < c.x ? -1 : 1;
  const bite = { x: c.x + 2 * s * side, y: c.y - h - 2 * s };
  const grip = { x: c.x + 14 * s * side, y: c.y - h - 22 * s };
  g.moveTo(bite.x, bite.y)
    .lineTo(grip.x, grip.y)
    .stroke({ width: 6 * s, color: palette.ink, cap: 'round' });
  g.moveTo(bite.x, bite.y)
    .lineTo(grip.x, grip.y)
    .stroke({ width: 3 * s, color: palette.log, cap: 'round' });
  g.poly([
    c.x - 6 * s * side,
    c.y - h - 6 * s,
    c.x + 4 * s * side,
    c.y - h - 2 * s,
    c.x - 2 * s * side,
    c.y - h + 3 * s,
  ])
    .fill(palette.axeHead)
    .stroke(THIN_INK);

  drawPiles(true);
}

/** A scatter of pale wood chips on the ground around `at`. */
function drawChips(g: Graphics, at: Vec, s: number): void {
  const chips: [number, number, number][] = [
    [-12, -3, 0.4],
    [-3, 4, -0.3],
    [7, -4, 0.9],
    [13, 3, 0.1],
    [0, -7, -0.8],
  ];
  for (const [dx, dy, turn] of chips) {
    const x = at.x + dx * s;
    const y = at.y + dy * s;
    const cos = Math.cos(turn) * 4 * s;
    const sin = Math.sin(turn) * 2 * s;
    g.poly([x - cos, y - sin, x + sin, y - cos / 2, x + cos, y + sin, x - sin, y + cos / 2])
      .fill(palette.logEnd)
      .stroke({ width: 1.5, color: palette.ink, alpha: 0.6 });
  }
}

/**
 * A construction site in world coordinates: a packed-earth plate, corner posts that rise
 * with build progress, the logs delivered so far, and a doorstep where the door will be.
 */
export function drawSite(
  g: Graphics,
  layout: BuildingLayout,
  delivered: number,
  progress: number,
): void {
  g.clear();
  const { origin, size } = layout;
  drawDoorstep(g, layout.door, doorFace(layout));
  const corners = diamond(origin.x, origin.y, size.w, size.h);
  const [top, right, bottom, left] = corners;
  g.poly(flat(corners)).fill(palette.siteGround).stroke(INK);
  const inner = corners.map((p) => lerp(lerp(top, bottom, 0.5), p, 0.7));
  g.poly(flat(inner)).stroke({ ...THIN_INK, alpha: 0.5 });

  const postH = WALL_H * (0.25 + 0.75 * progress);
  for (const p of [top, right, left]) {
    g.moveTo(p.x, p.y).lineTo(p.x, p.y - postH);
  }
  g.stroke({ width: 7, color: palette.ink, cap: 'round' });
  for (const p of [top, right, left]) {
    g.moveTo(p.x, p.y).lineTo(p.x, p.y - postH);
  }
  g.stroke({ width: 3, color: palette.sitePost, cap: 'round' });
  if (progress > 0) {
    g.moveTo(left.x, left.y - postH)
      .lineTo(top.x, top.y - postH)
      .lineTo(right.x, right.y - postH);
    g.stroke({ width: 7, color: palette.ink, cap: 'round', join: 'round' });
    g.moveTo(left.x, left.y - postH)
      .lineTo(top.x, top.y - postH)
      .lineTo(right.x, right.y - postH);
    g.stroke({ width: 3, color: palette.sitePost, cap: 'round', join: 'round' });
  }

  const centre = lerp(top, bottom, 0.55);
  drawGoodsPile(g, 'logs', centre.x, centre.y, delivered);
  // Front post last so it sits in front of the logs.
  g.moveTo(bottom.x, bottom.y).lineTo(bottom.x, bottom.y - postH);
  g.stroke({ width: 7, color: palette.ink, cap: 'round' });
  g.moveTo(bottom.x, bottom.y).lineTo(bottom.x, bottom.y - postH);
  g.stroke({ width: 3, color: palette.sitePost, cap: 'round' });
}

/** Which of a wall segment's four sides join another wall segment (a palisade or a Gate). */
export interface WallArms {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

/** World points of a tile's centre and the middles of its four edges. */
function tileMiddles(x: number, y: number): Record<keyof WallArms | 'centre', Vec> {
  return {
    centre: gridToWorld(x + 0.5, y + 0.5),
    north: gridToWorld(x + 0.5, y),
    east: gridToWorld(x + 1, y + 0.5),
    south: gridToWorld(x + 0.5, y + 1),
    west: gridToWorld(x, y + 0.5),
  };
}

/** One sharpened log stake standing at `p`, `h` tall. */
function drawStake(g: Graphics, p: Vec, h: number, color: number): void {
  const s = TILE_H / 64;
  const w = 9 * s;
  g.poly(
    flat([
      { x: p.x - w / 2, y: p.y },
      { x: p.x + w / 2, y: p.y },
      { x: p.x + w / 2, y: p.y - h },
      { x: p.x, y: p.y - h - 7 * s },
      { x: p.x - w / 2, y: p.y - h },
    ]),
  )
    .fill(color)
    .stroke(THIN_INK);
}

/** Stakes back to front, so nearer ones overlap farther ones. */
function drawStakes(g: Graphics, points: Vec[], h: number): void {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  sorted.forEach((p, i) => {
    drawStake(g, p, h, i % 2 === 0 ? palette.stake : palette.stakeLight);
  });
}

/**
 * A palisade segment: a row of sharpened stakes from the tile's centre out to each side that
 * joins another wall segment, so a line of them reads as one fence. A segment on its own runs
 * east–west. The stake on a shared edge belongs to the segment west or north of it.
 */
export function drawPalisade(g: Graphics, layout: BuildingLayout, arms: WallArms): void {
  g.clear();
  const m = tileMiddles(layout.origin.x, layout.origin.y);
  const s = TILE_H / 64;
  g.ellipse(m.centre.x, m.centre.y, 22 * s, 9 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const lone = !arms.north && !arms.east && !arms.south && !arms.west;
  const points: Vec[] = [m.centre];
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    if (!arms[side] && !(lone && (side === 'east' || side === 'west'))) continue;
    const ownsEdge = arms[side] && (side === 'east' || side === 'south');
    for (const t of ownsEdge ? [1 / 3, 2 / 3, 1] : [1 / 3, 2 / 3]) {
      points.push(lerp(m.centre, m[side], t));
    }
  }
  drawStakes(g, points, WALL_H * 1.05);
}

/**
 * A palisade segment or Gate Gloamlings have battered down: a few splintered stumps, until it
 * heals at Dawn.
 */
export function drawBrokenWall(g: Graphics, layout: BuildingLayout): void {
  g.clear();
  const m = tileMiddles(layout.origin.x, layout.origin.y);
  const s = TILE_H / 64;
  g.ellipse(m.centre.x, m.centre.y, 18 * s, 7 * s).fill({ color: palette.shadow, alpha: 0.3 });
  drawStakes(g, [lerp(m.centre, m.west, 0.5), m.centre, lerp(m.centre, m.east, 0.5)], WALL_H * 0.3);
}

/**
 * A Gate: a braced plank door between two tall posts, across the line of the wall (east–west
 * unless it only joins walls to the north or south).
 */
export function drawGate(g: Graphics, layout: BuildingLayout, arms: WallArms): void {
  g.clear();
  const m = tileMiddles(layout.origin.x, layout.origin.y);
  const s = TILE_H / 64;
  g.ellipse(m.centre.x, m.centre.y, 24 * s, 10 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const alongY = (arms.north || arms.south) && !arms.east && !arms.west;
  const back = alongY ? m.north : m.west;
  const front = alongY ? m.south : m.east;
  const h = WALL_H * 0.85;
  drawStake(g, back, WALL_H * 1.25, palette.stake);
  const a = lerp(back, front, 0.12);
  const b = lerp(back, front, 0.88);
  g.poly(flat([a, b, up(b, h), up(a, h)]))
    .fill(palette.gatePlank)
    .stroke(INK);
  for (const t of [0.25, 0.5, 0.75]) {
    const p = lerp(a, b, t);
    g.moveTo(p.x, p.y).lineTo(p.x, p.y - h);
  }
  g.stroke({ ...THIN_INK, alpha: 0.6 });
  // Two rails and a brace.
  for (const r of [0.2, 0.8]) g.moveTo(a.x, a.y - h * r).lineTo(b.x, b.y - h * r);
  g.moveTo(a.x, a.y - h * 0.2).lineTo(b.x, b.y - h * 0.8);
  g.stroke({ width: 4 * s, color: palette.stake, cap: 'round' });
  drawStake(g, front, WALL_H * 1.25, palette.stake);
}

/**
 * A wall segment's construction site: a trodden patch with short stakes that grow with
 * `progress` (0–1) and the logs delivered so far. No doorstep: its door is its own tile.
 */
export function drawWallSite(
  g: Graphics,
  layout: BuildingLayout,
  delivered: number,
  progress: number,
): void {
  g.clear();
  const { x, y } = layout.origin;
  const corners = diamond(x, y);
  const [top, , bottom] = corners;
  const mid = lerp(top, bottom, 0.5);
  const inner = corners.map((p) => lerp(mid, p, 0.8));
  g.poly(flat(inner))
    .fill({ color: palette.siteGround, alpha: 0.8 })
    .stroke({ ...THIN_INK, alpha: 0.5 });
  const m = tileMiddles(x, y);
  const stakes = [lerp(m.centre, m.west, 0.5), lerp(m.centre, m.east, 0.5)];
  drawStakes(g, stakes, WALL_H * (0.2 + 0.8 * progress));
  const pile = lerp(m.centre, m.south, 0.4);
  drawGoodsPile(g, 'logs', pile.x, pile.y, delivered);
}

/**
 * A groundwork site (a Drain or a Pass road) on its one tile: a plate of worked ground, the logs
 * delivered so far, and the work growing across the tile with build progress: a Drain's ditch
 * dug from west to east, a Pass road's logs laid from north to south. No label; like wall sites,
 * they come in long lines.
 */
export function drawGroundworkSite(
  g: Graphics,
  layout: BuildingLayout,
  kind: 'drain' | 'passRoad',
  delivered: number,
  progress: number,
): void {
  g.clear();
  const { x, y } = layout.origin;
  const corners = diamond(x, y);
  const [top, , bottom] = corners;
  const mid = lerp(top, bottom, 0.5);
  g.poly(flat(corners.map((p) => lerp(mid, p, 0.85))))
    .fill({ color: palette.siteGround, alpha: 0.7 })
    .stroke({ ...THIN_INK, alpha: 0.5 });
  if (progress > 0) {
    const work =
      kind === 'drain'
        ? diamond(x + 0.1, y + 0.38, 0.8 * progress, 0.24)
        : diamond(x + 0.22, y + 0.1, 0.56, 0.8 * progress);
    g.poly(flat(work))
      .fill(kind === 'drain' ? palette.ditch : palette.passRoad)
      .stroke(THIN_INK);
  }
  const m = tileMiddles(x, y);
  const pile = lerp(m.centre, m.south, 0.45);
  drawGoodsPile(g, 'logs', pile.x, pile.y, delivered);
}

/**
 * The hero, drawn around (0, 0) = their feet: taller than a villager, in a flared cloak with a
 * gold circlet, so it reads apart from villagers at a glance.
 */
export function drawHero(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 14 * s, 6 * s);
  // Cloak: a trapezoid flaring towards the ground, behind the body.
  g.poly([-7 * s, -40 * s, 7 * s, -40 * s, 15 * s, -2 * s, -15 * s, -2 * s])
    .fill(palette.heroCloak)
    .stroke(INK);
  g.roundRect(-8 * s, -38 * s, 16 * s, 32 * s, 7 * s)
    .fill(palette.heroTunic)
    .stroke(INK);
  g.rect(-8 * s, -20 * s, 16 * s, 4 * s).fill(palette.heroTrim);
  g.circle(0, -48 * s, 9 * s)
    .fill(palette.skin)
    .stroke(INK);
  g.moveTo(-9 * s, -52 * s)
    .lineTo(9 * s, -52 * s)
    .stroke({ width: 4 * s, color: palette.heroTrim, cap: 'round' });
}

/**
 * The hero Knocked out, lying on the ground at (0, 0): head to the left, cloak spread under it,
 * the same colours as `drawHero`.
 */
export function drawHeroFallen(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 30 * s, 9 * s);
  // Cloak spread out under the body, flaring towards the feet.
  g.poly([-16 * s, -9 * s, -16 * s, 3 * s, 26 * s, 8 * s, 26 * s, -12 * s])
    .fill(palette.heroCloak)
    .stroke(INK);
  g.roundRect(-14 * s, -9 * s, 32 * s, 13 * s, 6 * s)
    .fill(palette.heroTunic)
    .stroke(INK);
  g.rect(0, -9 * s, 4 * s, 13 * s).fill(palette.heroTrim);
  g.circle(-22 * s, -4 * s, 8 * s)
    .fill(palette.skin)
    .stroke(INK);
  g.moveTo(-27 * s, -11 * s)
    .lineTo(-27 * s, 3 * s)
    .stroke({ width: 4 * s, color: palette.heroTrim, cap: 'round' });
}

/** Three small stars circling (0, 0), over a Knocked-out head; rotate the Graphics to spin them. */
export function drawDizzyStars(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    g.star(Math.cos(a) * 13 * s, Math.sin(a) * 5 * s, 5, 5.5 * s, 2.5 * s)
      .fill(palette.heroTrim)
      .stroke({ width: 1.5 * s, color: palette.ink });
  }
}

/** A selection ring on the ground around (0, 0). */
export function drawSelectionRing(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  g.ellipse(0, 0, 22 * s, 11 * s).stroke({ width: 7 * s, color: palette.ink, alpha: 0.7 });
  g.ellipse(0, 0, 22 * s, 11 * s).stroke({ width: 3.5 * s, color: palette.selection });
}

/**
 * The hero's aura: a circle of `radiusTiles` around grid point (gx, gy), which on the 2:1
 * isometric ground is an ellipse.
 */
export function drawAuraRadius(g: Graphics, gx: number, gy: number, radiusTiles: number): void {
  const c = gridToWorld(gx, gy);
  const rx = (radiusTiles * TILE_W) / Math.SQRT2;
  const ry = (radiusTiles * TILE_H) / Math.SQRT2;
  g.ellipse(c.x, c.y, rx, ry)
    .fill({ color: palette.aura, alpha: 0.08 })
    .stroke({ width: 3, color: palette.aura, alpha: 0.7 });
}

/**
 * A soft round glow of `radius` world pixels centred on (x, y): rings fading outwards in
 * `palette.glow`. Meant for a layer blended additively over the dark; any light source can use it.
 */
export function drawGlow(g: Graphics, x: number, y: number, radius: number): void {
  const RINGS = 5;
  for (let i = RINGS; i >= 1; i--) {
    g.circle(x, y, (radius * i) / RINGS).fill({ color: palette.glow, alpha: 0.12 });
  }
}

/** A torch or brazier: what `drawLight` draws and where its flame burns. */
export type LightKind = 'torch' | 'brazier';

/** Height of a light's flame above its tile centre, in world pixels. */
function flameHeight(kind: LightKind): number {
  const s = TILE_H / 64;
  return (kind === 'torch' ? 46 : 22) * s;
}

/**
 * A torch (a pole with a pitch-wrapped head) or a brazier (an iron bowl on three legs, firewood
 * showing in it while it holds some), unlit: the flame and the pool of Light are
 * `drawLightPool`'s, on the lights layer.
 */
export function drawLight(
  g: Graphics,
  layout: BuildingLayout,
  kind: LightKind,
  fuel: number,
): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  g.ellipse(c.x, c.y, 14 * s, 6 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const top = flameHeight(kind);
  if (kind === 'torch') {
    g.rect(c.x - 3 * s, c.y - top, 6 * s, top)
      .fill(palette.torchPole)
      .stroke(THIN_INK);
    g.roundRect(c.x - 6 * s, c.y - top - 4 * s, 12 * s, 14 * s, 4 * s)
      .fill(fuel > 0 ? palette.firewood : palette.torchHead)
      .stroke(INK);
    return;
  }
  const rx = 17 * s;
  const ry = 7 * s;
  for (const dx of [-11, 0, 11]) {
    g.moveTo(c.x + dx * s * 0.6, c.y - top + ry)
      .lineTo(c.x + dx * s, c.y + (dx === 0 ? 3 : 0) * s)
      .stroke({ ...INK, width: 4, color: palette.iron });
  }
  g.moveTo(c.x - rx, c.y - top)
    .arc(c.x, c.y - top, rx, Math.PI, 0, true)
    .closePath()
    .fill(palette.iron)
    .stroke(INK);
  g.ellipse(c.x, c.y - top, rx, ry)
    .fill(palette.ironLight)
    .stroke(INK);
  if (fuel > 0) {
    for (const dx of [-7, 0, 7]) {
      g.moveTo(c.x + dx * s - 4 * s, c.y - top + 2 * s)
        .lineTo(c.x + dx * s + 4 * s, c.y - top - 3 * s)
        .stroke({ width: 4 * s, color: palette.firewood, cap: 'round' });
    }
  }
}

/**
 * A watchtower: four leaning stilts with a cross brace, a railed lookout platform and a peaked
 * roof, all in timber, and a ladder up on its door's side (behind the stilts when that faces away).
 */
export function drawWatchtower(g: Graphics, layout: BuildingLayout): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  g.ellipse(c.x, c.y, 26 * s, 11 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const deck = c.y - 78 * s;
  const back = isBackFace(doorFace(layout));
  if (back) drawLadder(g, layout, 78 * s);
  // Stilts: feet spread on the tile, tops drawn in under the platform.
  const feet = [
    { x: -22, y: 0 },
    { x: 0, y: -10 },
    { x: 22, y: 0 },
    { x: 0, y: 10 },
  ];
  for (const f of feet) {
    g.moveTo(c.x + f.x * s, c.y + f.y * s)
      .lineTo(c.x + f.x * 0.6 * s, deck + f.y * 0.6 * s)
      .stroke({ ...INK, width: 6 * s, color: palette.torchPole });
  }
  g.moveTo(c.x - 20 * s, c.y - 6 * s)
    .lineTo(c.x + 14 * s, deck + 20 * s)
    .moveTo(c.x + 20 * s, c.y - 6 * s)
    .lineTo(c.x - 14 * s, deck + 20 * s)
    .stroke({ width: 3 * s, color: palette.stake, cap: 'round' });
  if (!back) drawLadder(g, layout, 78 * s);
  // Platform: a flat diamond with a rail round it.
  const w = 20 * s;
  const h = 9 * s;
  g.poly([c.x - w, deck, c.x, deck - h, c.x + w, deck, c.x, deck + h])
    .fill(palette.wallLight)
    .stroke(INK);
  g.rect(c.x - w, deck, 2 * w, 5 * s)
    .fill(palette.wallDark)
    .stroke(THIN_INK);
  for (const dx of [-w, 0, w]) {
    g.moveTo(c.x + dx, deck + (dx === 0 ? h : 0))
      .lineTo(c.x + dx, deck + (dx === 0 ? h : 0) - 14 * s)
      .stroke({ ...THIN_INK, width: 3 * s, color: palette.torchPole });
  }
  g.moveTo(c.x - w, deck - 14 * s)
    .lineTo(c.x, deck + h - 14 * s)
    .lineTo(c.x + w, deck - 14 * s)
    .stroke({ ...THIN_INK, width: 3 * s, color: palette.torchPole });
  // Roof on two back posts.
  const eaves = deck - 30 * s;
  for (const dx of [-w + 3 * s, w - 3 * s]) {
    g.moveTo(c.x + dx, deck)
      .lineTo(c.x + dx, eaves)
      .stroke({ ...THIN_INK, width: 3 * s });
  }
  g.poly([c.x - w - 6 * s, eaves, c.x, eaves - 24 * s, c.x + w + 6 * s, eaves, c.x, eaves + 8 * s])
    .fill(palette.roof)
    .stroke(INK);
  g.moveTo(c.x, eaves - 24 * s)
    .lineTo(c.x, eaves + 8 * s)
    .stroke({ width: 2 * s, color: palette.roofDark });
}

/** A watchtower's ladder, from its door tile's side of the tile up to the platform `deck` high. */
function drawLadder(g: Graphics, layout: BuildingLayout, deck: number): void {
  const s = TILE_H / 64;
  const { origin } = layout;
  const { out } = doorway(layout);
  const cx = origin.x + 0.5;
  const cy = origin.y + 0.5;
  // `a` along the door's side, `o` out from the tile's middle, `z` up.
  const point = (a: number, o: number, z: number): Vec =>
    up(gridToWorld(cx - out.y * a + out.x * o, cy + out.x * a + out.y * o), z);
  const left = [point(-0.08, 0.4, 0), point(-0.08, 0.16, deck + 6 * s)] as const;
  const right = [point(0.08, 0.4, 0), point(0.08, 0.16, deck + 6 * s)] as const;
  const rails = [left, right];
  const rungs = Array.from({ length: 6 }, (_, i) => {
    const f = (i + 0.7) / 6.5;
    return [lerp(left[0], left[1], f), lerp(right[0], right[1], f)] as const;
  });
  for (const [p, q] of [...rungs, ...rails]) {
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  }
  g.stroke({ width: 5 * s, color: palette.ink, cap: 'round' });
  for (const [p, q] of [...rungs, ...rails]) {
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  }
  g.stroke({ width: 2.5 * s, color: palette.torchPole, cap: 'round' });
}

/**
 * The Militia bell: a bronze bell hanging from a timber frame. While it rings it swings, with
 * strokes of sound either side.
 */
export function drawBell(g: Graphics, layout: BuildingLayout, ringing: boolean): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  g.ellipse(c.x, c.y, 20 * s, 8 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const top = c.y - 58 * s;
  for (const dx of [-16, 16]) {
    g.rect(c.x + dx * s - 3 * s, top, 6 * s, 58 * s)
      .fill(palette.torchPole)
      .stroke(THIN_INK);
  }
  g.rect(c.x - 22 * s, top - 6 * s, 44 * s, 7 * s)
    .fill(palette.torchPole)
    .stroke(THIN_INK);
  const tilt = ringing ? 5 * s : 0;
  const hang = top + 2 * s;
  const mouth = hang + 26 * s;
  g.moveTo(c.x - 4 * s, hang)
    .quadraticCurveTo(c.x - 10 * s, hang + 4 * s, c.x - 11 * s + tilt, mouth - 6 * s)
    .lineTo(c.x - 14 * s + tilt, mouth)
    .lineTo(c.x + 14 * s + tilt, mouth)
    .lineTo(c.x + 11 * s + tilt, mouth - 6 * s)
    .quadraticCurveTo(c.x + 10 * s, hang + 4 * s, c.x + 4 * s, hang)
    .closePath()
    .fill(palette.bell)
    .stroke(INK);
  g.moveTo(c.x - 4 * s + tilt, hang + 8 * s)
    .lineTo(c.x - 7 * s + tilt, mouth - 4 * s)
    .stroke({ width: 3 * s, color: palette.bellLight, cap: 'round' });
  g.circle(c.x + tilt * 1.6, mouth + 3 * s, 3 * s)
    .fill(palette.iron)
    .stroke(THIN_INK);
  if (!ringing) return;
  for (const side of [-1, 1]) {
    for (const r of [28, 36]) {
      g.arc(
        c.x,
        mouth - 12 * s,
        r * s,
        side < 0 ? Math.PI * 0.8 : -Math.PI * 0.2,
        side < 0 ? Math.PI * 1.2 : Math.PI * 0.2,
      ).stroke({ width: 3 * s, color: palette.bellLight, cap: 'round' });
    }
  }
}

/**
 * A lit torch or brazier on the additive lights layer: the pool of Light over every tile it
 * lights (`radiusTiles` around its footprint, so the edge Gloamlings won't cross reads at a
 * glance), brightest at the middle, and its flame.
 */
export function drawLightPool(
  g: Graphics,
  layout: BuildingLayout,
  kind: LightKind,
  radiusTiles: number,
): void {
  const { origin, size } = layout;
  const cx = origin.x + size.w / 2;
  const cy = origin.y + size.h / 2;
  const around = (reach: number) =>
    diamond(
      cx - size.w / 2 - reach,
      cy - size.h / 2 - reach,
      size.w + 2 * reach,
      size.h + 2 * reach,
    );
  const RINGS = 4;
  for (let i = RINGS; i >= 1; i--) {
    g.poly(flat(around((radiusTiles * i) / RINGS))).fill({ color: palette.glow, alpha: 0.1 });
  }
  g.poly(flat(around(radiusTiles))).stroke({
    width: 2,
    color: palette.glow,
    alpha: 0.35,
    join: 'round',
  });

  const s = TILE_H / 64;
  const c = gridToWorld(cx, cy);
  const base = { x: c.x, y: c.y - flameHeight(kind) };
  const w = (kind === 'torch' ? 7 : 12) * s;
  const h = (kind === 'torch' ? 20 : 26) * s;
  drawGlow(g, base.x, base.y - h / 2, TILE_H * 0.7);
  const flame = (fw: number, fh: number, color: number) =>
    g
      .moveTo(base.x - fw, base.y)
      .quadraticCurveTo(base.x - fw, base.y - fh * 0.6, base.x, base.y - fh)
      .quadraticCurveTo(base.x + fw, base.y - fh * 0.6, base.x + fw, base.y)
      .closePath()
      .fill(color);
  flame(w, h, palette.glow);
  flame(w * 0.55, h * 0.6, palette.windowLit);
}

/** Ground marking under a Workplace the hero's aura is boosting. */
export function drawBoostedMark(g: Graphics, layout: BuildingLayout): void {
  const { origin, size } = layout;
  g.poly(flat(diamond(origin.x - 0.15, origin.y - 0.15, size.w + 0.3, size.h + 0.3)))
    .fill({ color: palette.aura, alpha: 0.25 })
    .stroke({ width: 4, color: palette.aura, alpha: 0.9, join: 'round' });
}

/** One piece of `resource` held over the head, drawn relative to the villager's feet. */
export function drawCarriedGoods(g: Graphics, resource: ResourceId): void {
  g.clear();
  const s = TILE_H / 64;
  PIECES[resource].draw(g, 0, -56 * s, s);
}

/** The goods in the hero's hands, stacked over its head, drawn relative to its feet. */
export function drawHeroLoad(g: Graphics, goods: ResourceAmount | null): void {
  g.clear();
  if (!goods) return;
  const s = TILE_H / 64;
  const piece = PIECES[goods.resource];
  for (let i = 0; i < goods.amount; i++) {
    piece.draw(g, (i % 2) * 3 * s, (-64 - piece.h * 0.9 * i) * s, s);
  }
}

/** An axe; its pivot (0, 0) is the handle end, held at the villager's side. */
export function drawAxe(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  g.moveTo(0, 0)
    .lineTo(0, -24 * s)
    .stroke({ width: 6 * s, color: palette.ink, cap: 'round' });
  g.moveTo(0, 0)
    .lineTo(0, -24 * s)
    .stroke({ width: 3 * s, color: palette.trunk, cap: 'round' });
  g.poly([0, -26 * s, 10 * s, -30 * s, 10 * s, -16 * s, 0, -20 * s])
    .fill(palette.axeHead)
    .stroke(THIN_INK);
}

/** Placement preview: the building tinted valid/invalid, its yard fainter, the door tile outlined. */
export function drawPlacementGhost(g: Graphics, layout: BuildingLayout, valid: boolean): void {
  g.clear();
  const color = valid ? palette.valid : palette.invalid;
  const { origin, size, door, yard } = layout;
  g.poly(flat(diamond(origin.x, origin.y, size.w, size.h)))
    .fill({ color, alpha: 0.45 })
    .stroke(INK);
  if (yard) {
    g.poly(flat(diamond(yard.x, yard.y)))
      .fill({ color, alpha: 0.3 })
      .stroke(THIN_INK);
  }
  drawDoorstep(g, door, doorFace(layout));
  g.poly(flat(diamond(door.x, door.y)))
    .fill({ color, alpha: 0.15 })
    .stroke({ width: 2, color, alpha: 0.9 });
}

/** Road tiles on one tile: `open` says which of +x, +y, −x, −y also hold road. */
export interface RoadTile {
  x: number;
  y: number;
  kind: RoadId;
  open: [boolean, boolean, boolean, boolean];
}

/** Each Road kind's fill and edge. */
const ROAD_COLORS: Record<RoadId, { fill: number; edge: number }> = {
  dirt_path: { fill: palette.dirt, edge: palette.dirtDark },
  pass_road: { fill: palette.passRoad, edge: palette.passRoadDark },
};

/** Rects (in tiles, relative to the tile origin) of a road piece's centre and arms, `pad` wider. */
function roadRects(t: RoadTile, pad: number): [number, number, number, number][] {
  const a = 0.3 - pad;
  const b = 0.4 + pad * 2;
  const rects: [number, number, number, number][] = [[a, a, b, b]];
  if (t.open[0]) rects.push([a + b, a, 1 - a - b, b]);
  if (t.open[1]) rects.push([a, a + b, b, 1 - a - b]);
  if (t.open[2]) rects.push([0, a, a, b]);
  if (t.open[3]) rects.push([a, 0, b, a]);
  return rects;
}

/**
 * Roads: straight pieces, corners and junctions from each tile's open sides, in each kind's
 * colours. A Pass road's pieces are wider and ribbed with the logs it's laid from.
 */
export function drawRoads(g: Graphics, tiles: RoadTile[]): void {
  g.clear();
  for (const edge of [true, false]) {
    for (const t of tiles) {
      const colors = ROAD_COLORS[t.kind];
      const wide = t.kind === 'pass_road' ? 0.06 : 0;
      for (const [rx, ry, rw, rh] of roadRects(t, (edge ? 0.06 : 0) + wide)) {
        g.poly(flat(diamond(t.x + rx, t.y + ry, rw, rh))).fill(edge ? colors.edge : colors.fill);
      }
    }
  }
  // Log seams across each Pass road tile, along both axes where it runs.
  for (const t of tiles) {
    if (t.kind !== 'pass_road') continue;
    const alongX = t.open[0] || t.open[2] || !(t.open[1] || t.open[3]);
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const [a, b] = alongX
        ? [gridToWorld(t.x + f, t.y + 0.26), gridToWorld(t.x + f, t.y + 0.74)]
        : [gridToWorld(t.x + 0.26, t.y + f), gridToWorld(t.x + 0.74, t.y + f)];
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
  }
  g.stroke({ ...THIN_INK, alpha: 0.45 });
}

/** A Road tile on the heat-map, and how busy it is: 0 unused, 1 to `HEAT_LEVELS` busiest. */
export interface HeatTile {
  x: number;
  y: number;
  level: number;
}

const HEAT_COLORS = [palette.heatNone, palette.heat1, palette.heat2, palette.heat3, palette.heat4];
export const HEAT_LEVELS = HEAT_COLORS.length - 1;

/** The road heat-map: each Road tile tinted by its traffic level. */
export function drawHeatMap(g: Graphics, tiles: HeatTile[]): void {
  g.clear();
  for (const t of tiles) {
    const color = HEAT_COLORS[Math.min(t.level, HEAT_LEVELS)] ?? palette.heatNone;
    g.poly(flat(diamond(t.x + 0.1, t.y + 0.1, 0.8, 0.8))).fill({ color, alpha: 0.8 });
  }
}

/** Bare dirt under a stockpile rectangle. */
export function drawPileGround(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.poly(flat(diamond(x, y, w, h)))
    .fill(palette.pileGround)
    .stroke(THIN_INK);
}

/** Goods on one stockpile tile, drawn around (0, 0) = the tile centre. */
export function drawGoodsStack(g: Graphics, goods: ResourceAmount): void {
  g.clear();
  drawGoodsPile(g, goods.resource, 0, 6, goods.amount);
}

/**
 * Goods in a Workplace yard, drawn around (0, 0) = the tile centre like a stockpile tile's: a pile
 * per output held, the first at the back.
 */
export function drawYardGoods(g: Graphics, goods: readonly ResourceAmount[]): void {
  g.clear();
  const held = goods.filter((x) => x.amount > 0);
  held.forEach((x, i) => {
    const offset = (i - (held.length - 1) / 2) * TILE_H * 0.44;
    drawGoodsPile(g, x.resource, 0, 6 + offset, x.amount);
  });
}

/** A warning bubble centred on (x, y): a worker, struck through. */
export function drawMissingIcon(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  g.circle(x, y - 4 * s, 3.5 * s).fill(palette.ink);
  g.roundRect(x - 5 * s, y + 1 * s, 10 * s, 8 * s, 3 * s).fill(palette.ink);
  g.moveTo(x - r * 0.7, y - r * 0.7)
    .lineTo(x + r * 0.7, y + r * 0.7)
    .stroke({ width: 3 * s, color: palette.invalid, cap: 'round' });
}

/** A five-pointed star centred on (x, y), `r` to each point: a Master's mark. */
function drawMasterStar(g: Graphics, x: number, y: number, r: number): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    points.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(points).fill(palette.gilt).stroke(THIN_INK);
}

/** A bubble centred on (x, y) over a workshop waiting for its Master: the Master's star, and "...". */
export function drawNoMasterIcon(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  drawMasterStar(g, x, y - 2 * s, 7 * s);
  for (const dx of [-4, 0, 4]) g.circle(x + dx * s, y + 8 * s, 1.4 * s).fill(palette.ink);
}

/** A bubble centred on (x, y) over a workshop waiting for `resource`: a piece of it, and "...". */
export function drawWaitingIcon(g: Graphics, x: number, y: number, resource: ResourceId): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  PIECES[resource].draw(g, x, y - 2 * s, s * 0.8);
  for (const dx of [-4, 0, 4]) g.circle(x + dx * s, y + 7 * s, 1.4 * s).fill(palette.ink);
}

/** A bubble centred on (x, y) over a workshop whose output buffer is full: a pile up to a brim. */
export function drawOutputFullIcon(g: Graphics, x: number, y: number, resource: ResourceId): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  const piece = PIECES[resource];
  const ps = s * 0.55;
  piece.draw(g, x - (piece.w / 2) * ps, y + 5 * s, ps);
  piece.draw(g, x + (piece.w / 2) * ps, y + 5 * s, ps);
  piece.draw(g, x, y + 5 * s - piece.h * ps, ps);
  g.moveTo(x - r * 0.7, y - 7 * s)
    .lineTo(x + r * 0.7, y - 7 * s)
    .stroke({ width: 3 * s, color: palette.invalid, cap: 'round' });
}

/** A bubble centred on (x, y) over a hunter's lodge with no Game to hunt: a haunch, struck through. */
export function drawNoGameIcon(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  drawMeat(g, x - 1 * s, y, s * 0.8);
  g.moveTo(x - r * 0.7, y - r * 0.7)
    .lineTo(x + r * 0.7, y + r * 0.7)
    .stroke({ width: 3 * s, color: palette.invalid, cap: 'round' });
}

/** A warning bubble centred on (x, y) over a cold House: a piece of firewood, struck through. */
export function drawNoFirewoodIcon(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  const r = 13 * s;
  g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
  drawFirewood(g, x - 1 * s, y, s * 0.8);
  g.moveTo(x - r * 0.7, y - r * 0.7)
    .lineTo(x + r * 0.7, y + r * 0.7)
    .stroke({ width: 3 * s, color: palette.invalid, cap: 'round' });
}

/** A six-armed snowflake centred on (x, y), `r` from the centre to each arm's tip. */
function drawSnowflake(g: Graphics, x: number, y: number, r: number, width: number): void {
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    g.moveTo(x - dx, y - dy).lineTo(x + dx, y + dy);
  }
  g.stroke({ width, color: palette.ink, cap: 'round' });
}

/** What a villager's status icons show. */
export interface VillagerStatus {
  homeless: boolean;
  tired: boolean;
  hungry: boolean;
  cold: boolean;
  /** A hunter walking back from a hunt empty-handed. */
  noCatch: boolean;
  /** A Master: their mark, first in the row and always shown. */
  master: boolean;
}

/**
 * Status icons over a villager's head, drawn relative to its feet: a Master's gilt star, a House
 * struck through when
 * it's Homeless, "zzz" when it's Tired, an empty bowl when it's Hungry, a snowflake when it's
 * Cold, a haunch struck through
 * when a hunter comes back with no catch. Every icon that applies shows, side by side.
 */
export function drawVillagerStatus(g: Graphics, status: VillagerStatus): void {
  g.clear();
  const s = TILE_H / 64;
  const { homeless, tired, hungry, cold, noCatch, master } = status;
  const icons = [
    master && 'master',
    homeless && 'homeless',
    tired && 'tired',
    hungry && 'hungry',
    cold && 'cold',
    noCatch && 'noCatch',
  ].filter(Boolean);
  const r = 9 * s;
  icons.forEach((icon, i) => {
    const x = (i - (icons.length - 1) / 2) * (2 * r + 3 * s);
    const y = -66 * s;
    g.circle(x, y, r).fill(palette.iconBg).stroke(INK);
    if (icon === 'master') {
      drawMasterStar(g, x, y, 6.5 * s);
    } else if (icon === 'homeless') {
      g.poly([
        x - 5 * s,
        y,
        x,
        y - 5 * s,
        x + 5 * s,
        y,
        x + 5 * s,
        y + 5 * s,
        x - 5 * s,
        y + 5 * s,
      ]).fill(palette.ink);
      g.moveTo(x - r * 0.7, y - r * 0.7)
        .lineTo(x + r * 0.7, y + r * 0.7)
        .stroke({ width: 2.5 * s, color: palette.invalid, cap: 'round' });
    } else if (icon === 'hungry') {
      // An empty bowl: a half-disc under a rim.
      g.moveTo(x - 6 * s, y - 1 * s)
        .arc(x, y - 1 * s, 6 * s, 0, Math.PI)
        .closePath()
        .fill(palette.ink);
      g.moveTo(x - 7 * s, y - 1.5 * s)
        .lineTo(x + 7 * s, y - 1.5 * s)
        .stroke({ width: 1.5 * s, color: palette.ink, cap: 'round' });
    } else if (icon === 'cold') {
      drawSnowflake(g, x, y, 6 * s, 1.5 * s);
    } else if (icon === 'noCatch') {
      drawMeat(g, x - 1 * s, y, s * 0.55);
      g.moveTo(x - r * 0.7, y - r * 0.7)
        .lineTo(x + r * 0.7, y + r * 0.7)
        .stroke({ width: 2.5 * s, color: palette.invalid, cap: 'round' });
    } else {
      // Three Zs, growing up and to the right.
      for (const [dx, dy, size] of [
        [-4, 3, 2.5],
        [0, -1, 3],
        [4, -5, 3.5],
      ] as const) {
        const zx = x + dx * s;
        const zy = y + dy * s;
        const h = size * s;
        g.moveTo(zx - h, zy - h)
          .lineTo(zx + h, zy - h)
          .lineTo(zx - h, zy + h)
          .lineTo(zx + h, zy + h)
          .stroke({ width: 1.5 * s, color: palette.ink, cap: 'round', join: 'round' });
      }
    }
  });
}

/**
 * A monster Den, drawn around (0, 0) = the centre of its tile: an earth mound with a black mouth,
 * thorns and a bone.
 */
export function drawDen(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 34 * s, 15 * s);
  const mound = flat([
    { x: -32 * s, y: 4 * s },
    { x: -24 * s, y: -14 * s },
    { x: -8 * s, y: -24 * s },
    { x: 10 * s, y: -24 * s },
    { x: 26 * s, y: -14 * s },
    { x: 32 * s, y: 4 * s },
  ]);
  g.poly(mound).fill(palette.denEarth);
  g.poly(
    flat([
      { x: 10 * s, y: -24 * s },
      { x: 26 * s, y: -14 * s },
      { x: 32 * s, y: 4 * s },
      { x: 14 * s, y: 4 * s },
    ]),
  ).fill(palette.denEarthDark);
  g.poly(mound).stroke(INK);
  g.ellipse(-2 * s, -4 * s, 13 * s, 9 * s)
    .fill(palette.denMouth)
    .stroke(INK);
  g.moveTo(-26 * s, -10 * s).lineTo(-36 * s, -26 * s);
  g.moveTo(-14 * s, -20 * s).lineTo(-18 * s, -38 * s);
  g.moveTo(18 * s, -18 * s).lineTo(28 * s, -34 * s);
  g.stroke({ width: 3 * s, color: palette.ink, cap: 'round' });
  g.moveTo(14 * s, 2 * s)
    .lineTo(24 * s, -2 * s)
    .stroke({ width: 3 * s, color: palette.bone, cap: 'round' });
}

/**
 * A cleared Den's cache, drawn around (0, 0) = the centre of its tile: churned earth where the
 * mound stood, and a small pile of each resource left, back to front.
 */
export function drawCache(g: Graphics, goods: readonly ResourceAmount[]): void {
  g.clear();
  const s = TILE_H / 64;
  g.ellipse(0, 4 * s, 30 * s, 13 * s)
    .fill(palette.denEarth)
    .stroke(THIN_INK);
  goods.forEach(({ resource, amount }, i) => {
    const side = goods.length === 1 ? 0 : i === 0 ? -1 : 1;
    drawGoodsPile(g, resource, side * 12 * s, (2 + i * 8) * s, amount);
  });
}

/**
 * Ruins, drawn around (0, 0) = the centre of its tile: an old flagstone floor, broken wall stubs
 * with moss, and a toppled column. Once Searched, the floor is dug through in the middle.
 */
export function drawRuins(g: Graphics, searched: boolean): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 42 * s, 18 * s);
  g.poly(
    flat([
      { x: -38 * s, y: 0 },
      { x: 0, y: -19 * s },
      { x: 38 * s, y: 0 },
      { x: 0, y: 19 * s },
    ]),
  )
    .fill(palette.ruinDark)
    .stroke(THIN_INK);
  g.moveTo(-19 * s, -9.5 * s).lineTo(19 * s, 9.5 * s);
  g.moveTo(19 * s, -9.5 * s).lineTo(-19 * s, 9.5 * s);
  g.stroke({ ...THIN_INK, alpha: 0.35 });
  if (searched) {
    g.ellipse(2 * s, 1 * s, 15 * s, 6.5 * s)
      .fill(palette.denEarth)
      .stroke(THIN_INK);
    g.ellipse(2 * s, 2 * s, 8 * s, 3 * s).fill(palette.denMouth);
  }
  // A wall stub standing from (x, y), `w` either side and `h` tall, its top broken off by `jag`.
  const stub = (x: number, y: number, w: number, h: number, jag: number) => {
    g.poly(
      flat([
        { x: x - w, y },
        { x: x - w, y: y - h },
        { x: x - w / 3, y: y - h + jag },
        { x: x + w / 3, y: y - h - jag / 2 },
        { x: x + w, y: y - h + jag },
        { x: x + w, y },
      ]),
    )
      .fill(palette.ruin)
      .stroke(INK);
    g.moveTo(x - w, y - h / 2)
      .lineTo(x + w, y - h / 2)
      .stroke({ ...THIN_INK, alpha: 0.5 });
    g.ellipse(x - w / 2, y - h + jag + 2 * s, w / 2.5, 3 * s).fill(palette.ruinMoss);
  };
  stub(-16 * s, -4 * s, 10 * s, 30 * s, 8 * s);
  stub(14 * s, -8 * s, 8 * s, 20 * s, 6 * s);
  // A toppled column in front.
  g.poly(
    flat([
      { x: -20 * s, y: 8 * s },
      { x: 12 * s, y: 14 * s },
      { x: 12 * s, y: 22 * s },
      { x: -20 * s, y: 16 * s },
    ]),
  )
    .fill(palette.ruin)
    .stroke(INK);
  g.ellipse(12 * s, 18 * s, 3 * s, 4 * s)
    .fill(palette.ruinDark)
    .stroke(THIN_INK);
  g.ellipse(-6 * s, 12 * s, 5 * s, 2 * s).fill(palette.ruinMoss);
}

/**
 * A Shrine, drawn around (0, 0) = the centre of its tile: a pale standing stone with a carved
 * spiral on a low plinth, and a gilt offering bowl at its foot.
 */
export function drawShrine(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 26 * s, 11 * s);
  g.poly(
    flat([
      { x: -22 * s, y: 0 },
      { x: 0, y: -11 * s },
      { x: 22 * s, y: 0 },
      { x: 0, y: 11 * s },
    ]),
  )
    .fill(palette.shrineDark)
    .stroke(INK);
  const stone = flat([
    { x: -10 * s, y: 2 * s },
    { x: -12 * s, y: -30 * s },
    { x: -6 * s, y: -46 * s },
    { x: 4 * s, y: -50 * s },
    { x: 11 * s, y: -40 * s },
    { x: 10 * s, y: 2 * s },
  ]);
  g.poly(stone).fill(palette.shrine);
  g.poly(
    flat([
      { x: 4 * s, y: -50 * s },
      { x: 11 * s, y: -40 * s },
      { x: 10 * s, y: 2 * s },
      { x: 4 * s, y: 3 * s },
    ]),
  ).fill(palette.shrineDark);
  g.poly(stone).stroke(INK);
  // The carved spiral.
  g.moveTo(-1 * s, -26 * s)
    .arc(-1 * s, -28 * s, 2 * s, Math.PI / 2, Math.PI * 2.2)
    .arc(-1 * s, -28 * s, 5 * s, Math.PI * 0.2, Math.PI * 1.8)
    .stroke({ ...THIN_INK, alpha: 0.7 });
  g.ellipse(-12 * s, 6 * s, 6 * s, 2.5 * s)
    .fill(palette.offering)
    .stroke(THIN_INK);
}

/**
 * An Abandoned mine, drawn around (0, 0) = the centre of its tile, in front of its iron Deposit
 * (whose rusty edges still show): a black mouth under a timber frame, a plank nailed half across.
 */
export function drawAbandonedMine(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  g.poly(
    flat([
      { x: -9 * s, y: 10 * s },
      { x: -9 * s, y: -8 * s },
      { x: -5 * s, y: -15 * s },
      { x: 5 * s, y: -15 * s },
      { x: 9 * s, y: -8 * s },
      { x: 9 * s, y: 10 * s },
    ]),
  ).fill(palette.denMouth);
  const frame = () => {
    g.moveTo(-10 * s, 11 * s).lineTo(-10 * s, -14 * s);
    g.moveTo(10 * s, 11 * s).lineTo(10 * s, -14 * s);
    g.moveTo(-14 * s, -16 * s).lineTo(14 * s, -16 * s);
  };
  frame();
  g.stroke({ ...INK, width: 8 * s });
  frame();
  g.stroke({ ...INK, width: 5 * s, color: palette.plankDark });
  g.moveTo(-12 * s, 1 * s).lineTo(8 * s, -4 * s);
  g.stroke({ ...INK, width: 7 * s });
  g.moveTo(-12 * s, 1 * s).lineTo(8 * s, -4 * s);
  g.stroke({ ...INK, width: 4 * s, color: palette.plank });
}

/** A progress bar centred on (x, y), `percent` filled from the left, in an ink frame. */
export function drawProgressBar(g: Graphics, x: number, y: number, percent: number): void {
  const s = TILE_H / 64;
  const w = 26 * s;
  const h = 5 * s;
  const left = x - w / 2;
  const top = y - h / 2;
  g.rect(left, top, w, h).fill(palette.healthLost);
  const filled = (w * Math.max(0, Math.min(percent, 100))) / 100;
  if (filled > 0) g.rect(left, top, filled, h).fill(palette.aura);
  g.rect(left, top, w, h).stroke({ ...INK, width: 1.5 });
}

/** Where a Gloamling's eyes sit, relative to its feet, in art units (× TILE_H / 64). */
const GLOAMLING_EYES: Vec[] = [
  { x: -6, y: -18 },
  { x: 0, y: -21 },
  { x: 6, y: -18 },
  { x: -3, y: -13 },
  { x: 4, y: -13 },
];

/** A Gloamling's many eyes around (x, y) = its feet. */
export function drawGloamlingEyes(g: Graphics, x: number, y: number): void {
  const s = TILE_H / 64;
  for (const eye of GLOAMLING_EYES) {
    g.circle(x + eye.x * s, y + eye.y * s, 1.8 * s).fill(palette.gloamEye);
  }
}

/** A health bar centred on (x, y): `hp` of `maxHp` filled from the left, in an ink frame. */
export function drawHealthBar(g: Graphics, x: number, y: number, hp: number, maxHp: number): void {
  const s = TILE_H / 64;
  const w = 26 * s;
  const h = 5 * s;
  const left = x - w / 2;
  const top = y - h / 2;
  g.rect(left, top, w, h).fill(palette.healthLost);
  const filled = (w * Math.max(0, Math.min(hp, maxHp))) / maxHp;
  if (filled > 0) g.rect(left, top, filled, h).fill(palette.health);
  g.rect(left, top, w, h).stroke({ ...INK, width: 1.5 });
}

/** A Gloamling, drawn around (0, 0) = its feet: a small hunched shadow, ragged at the hem. */
export function drawGloamling(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 12 * s, 5 * s);
  g.poly(
    flat([
      { x: -12 * s, y: 0 },
      { x: -13 * s, y: -14 * s },
      { x: -8 * s, y: -25 * s },
      { x: 0, y: -29 * s },
      { x: 9 * s, y: -25 * s },
      { x: 13 * s, y: -14 * s },
      { x: 12 * s, y: 0 },
      { x: 7 * s, y: -4 * s },
      { x: 3 * s, y: 0 },
      { x: -2 * s, y: -4 * s },
      { x: -7 * s, y: 0 },
    ]),
  )
    .fill(palette.gloam)
    .stroke(INK);
  g.ellipse(-4 * s, -23 * s, 5 * s, 2.5 * s).fill(palette.gloamLight);
  drawGloamlingEyes(g, 0, 0);
}

/** The dark rings around Dens, shown while placing a building: nothing can be built there. */
export function drawDarkRing(g: Graphics, tiles: { x: number; y: number }[]): void {
  g.clear();
  for (const t of tiles) {
    g.poly(flat(diamond(t.x, t.y))).fill({ color: palette.darkRing, alpha: 0.45 });
  }
}

/** Tool preview: a set of tiles tinted valid/invalid. */
export function drawTileGhost(
  g: Graphics,
  tiles: { x: number; y: number }[],
  valid: boolean,
): void {
  g.clear();
  const color = valid ? palette.valid : palette.invalid;
  for (const t of tiles) {
    g.poly(flat(diamond(t.x, t.y)))
      .fill({ color, alpha: 0.4 })
      .stroke({ width: 2, color, alpha: 0.9 });
  }
}

/**
 * A Hunting ground's tiles outlined on the ground in its health `color`, with a faint wash inside.
 * The outline follows the edges where a ground tile meets a tile off the ground, whatever its shape.
 */
export function drawHuntingGround(g: Graphics, tiles: readonly Tile[], color: number): void {
  drawTileArea(g, tiles, color, 0.1);
}

/**
 * The Reserve's tiles on the ground: a wash, hatched along the x axis so it reads apart from a
 * Hunting ground's, outlined where it meets tiles off it. `strong` for the woodcutter's hut
 * preview, which picks out the Reserve tiles in its radius.
 */
export function drawReserve(g: Graphics, tiles: readonly Tile[], strong = false): void {
  if (tiles.length === 0) return;
  for (const t of tiles) {
    const [top, right, bottom, left] = diamond(t.x, t.y);
    // Two lines across the tile, a third and two thirds of the way from its top-left edge.
    for (const f of [1 / 3, 2 / 3]) {
      const from = lerp(top, left, f);
      const to = lerp(right, bottom, f);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y);
    }
  }
  g.stroke({ width: 1.5, color: palette.reserve, alpha: strong ? 0.9 : 0.45 });
  drawTileArea(g, tiles, palette.reserve, strong ? 0.35 : 0.14);
}

/**
 * Fields on the ground: tilled earth with furrows, then by stage green shoots (sown), golden stalks
 * (ripe) or pale stubble (harvested), and a Fieldstone where the frost pushed one up.
 */
export function drawFields(g: Graphics, fields: readonly { tile: Tile; field: FieldTile }[]): void {
  const FURROWS = [0.2, 0.4, 0.6, 0.8];
  for (const { tile } of fields) {
    const [top, right, bottom, left] = diamond(tile.x, tile.y);
    const c = gridToWorld(tile.x + 0.5, tile.y + 0.5);
    const inset = (v: Vec) => lerp(c, v, 0.92);
    g.poly(flat([inset(top), inset(right), inset(bottom), inset(left)]));
  }
  g.fill({ color: palette.fieldSoil, alpha: 0.9 });
  for (const { tile } of fields) {
    const [top, right, bottom, left] = diamond(tile.x, tile.y);
    for (const f of FURROWS) {
      const from = lerp(lerp(top, left, f), lerp(right, bottom, f), 0.08);
      const to = lerp(lerp(top, left, f), lerp(right, bottom, f), 0.92);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y);
    }
  }
  g.stroke({ width: 2, color: palette.fieldFurrow, alpha: 0.8, cap: 'round' });
  // Along each furrow, a few plants: shoots, stalks or stubble by the Field's stage.
  const plants = (stage: FieldTile['stage']) =>
    fields.flatMap(({ tile, field }) => {
      if (field.stage !== stage) return [];
      const [top, right, bottom, left] = diamond(tile.x, tile.y);
      return FURROWS.flatMap((f) =>
        [0.25, 0.5, 0.75].map((along) => lerp(lerp(top, left, f), lerp(right, bottom, f), along)),
      );
    });
  const s = TILE_H / 64;
  for (const p of plants('sown')) {
    g.moveTo(p.x - 2 * s, p.y - 4 * s)
      .lineTo(p.x, p.y)
      .lineTo(p.x + 2 * s, p.y - 4 * s);
  }
  g.stroke({ width: 1.6 * s, color: palette.sprout, cap: 'round' });
  const ripe = plants('ripe');
  for (const p of ripe) g.moveTo(p.x, p.y).lineTo(p.x, p.y - 9 * s);
  g.stroke({ width: 1.4 * s, color: palette.grainDark, cap: 'round' });
  for (const p of ripe) g.ellipse(p.x, p.y - 10 * s, 1.8 * s, 3 * s);
  g.fill(palette.grain);
  for (const p of plants('stubble')) g.moveTo(p.x, p.y).lineTo(p.x, p.y - 2.5 * s);
  g.stroke({ width: 1.4 * s, color: palette.stubble, cap: 'round' });
  for (const { tile, field } of fields) {
    if (!field.stone) continue;
    const c = gridToWorld(tile.x + 0.5, tile.y + 0.5);
    g.poly([
      c.x - 7 * s,
      c.y + 2 * s,
      c.x - 4 * s,
      c.y - 4 * s,
      c.x + 3 * s,
      c.y - 5 * s,
      c.x + 7 * s,
      c.y + 2 * s,
    ])
      .fill(palette.stone)
      .stroke(THIN_INK);
  }
}

/** A wash of `color` over `tiles`, outlined where a tile meets one off the set. */
function drawTileArea(g: Graphics, tiles: readonly Tile[], color: number, wash: number): void {
  if (tiles.length === 0) return;
  const on = new Set(tiles.map((t) => `${t.x},${t.y}`));
  for (const t of tiles) g.poly(flat(diamond(t.x, t.y)));
  g.fill({ color, alpha: wash });
  // Each tile's corners (top, right, bottom, left) and the neighbour across each edge.
  const edges: [Vec, Vec][] = [];
  for (const t of tiles) {
    const [top, right, bottom, left] = diamond(t.x, t.y);
    if (!on.has(`${t.x},${t.y - 1}`)) edges.push([top, right]);
    if (!on.has(`${t.x + 1},${t.y}`)) edges.push([right, bottom]);
    if (!on.has(`${t.x},${t.y + 1}`)) edges.push([bottom, left]);
    if (!on.has(`${t.x - 1},${t.y}`)) edges.push([left, top]);
  }
  const outline = () => {
    for (const [a, b] of edges) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  };
  outline();
  g.stroke({ width: 4, color: palette.ink, alpha: 0.5, cap: 'round' });
  outline();
  g.stroke({ width: 2.5, color, alpha: 0.9, cap: 'round' });
}

/**
 * Game fleeing a ground, around (x, y): a ring of dust puffs spreading and fading as `t` goes
 * from 0 to 1.
 */
export function drawFledPuff(g: Graphics, x: number, y: number, t: number): void {
  const s = TILE_H / 64;
  const spread = (10 + 40 * t) * s;
  const alpha = 0.8 * (1 - t);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.circle(x + Math.cos(a) * spread, y + Math.sin(a) * spread * 0.5 - 20 * t * s, (8 + 6 * t) * s)
      .fill({ color: palette.puff, alpha })
      .stroke({ width: 2 * s, color: palette.ink, alpha: alpha * 0.6 });
  }
}
