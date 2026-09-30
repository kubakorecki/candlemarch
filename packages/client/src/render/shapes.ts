// Placeholder art drawn in code: bold ink outlines, flat earthy fills. Colours come from palette.ts.
import type { ResourceAmount, ResourceId, TerrainId } from '@candlemarch/content';
import type { BuildingLayout } from '@candlemarch/sim';
import type { Graphics } from 'pixi.js';
import { gridToWorld, TILE_H, TILE_W, type Vec } from './iso';
import { palette } from './palette';

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
 * `drawEdges`, then `drawMapOutline`. Checkered land, faint grid lines, then river and Ford tiles
 * as flat water (pale cracked ice when frozen), and ink where terrain groups meet.
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
 * and Swamp (with pools and reeds); Mountain as a craggy peak; Pass snow as a white drift.
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

/** A Mountain tile: dark rock with a peak on it, lit on its west face. */
function drawMountainTile(g: Graphics, x: number, y: number): void {
  const [, right, , left] = diamond(x, y);
  g.poly(flat(diamond(x, y))).fill(palette.mountainDark);
  const rise = TILE_H * (0.3 + tileVariant(x, y, 3) * 0.06);
  const base = gridToWorld(x + 0.5, y + 0.5);
  const foot = gridToWorld(x + 0.8, y + 0.8);
  const peak = up(gridToWorld(x + 0.45, y + 0.45), rise);
  g.poly(flat([left, peak, foot])).fill(palette.mountainLight);
  g.poly(flat([peak, right, foot])).fill(palette.mountain);
  g.moveTo(left.x, left.y).lineTo(peak.x, peak.y).lineTo(right.x, right.y);
  g.moveTo(peak.x, peak.y).lineTo(foot.x, foot.y);
  g.stroke(THIN_INK);
  // A snow cap on the tallest.
  if (base.y - peak.y > TILE_H * 0.4) {
    const l = lerp(peak, left, 0.18);
    const r = lerp(peak, right, 0.18);
    g.poly(flat([l, peak, r]))
      .fill(palette.snow)
      .stroke({ ...THIN_INK, width: 1.5 });
  }
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

function groundShadow(g: Graphics, rx: number, ry: number): void {
  groundShadowAt(g, 0, 0, rx, ry);
}

/** A soft shadow on the ground centred on (x, y). */
export function groundShadowAt(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry).fill({ color: palette.shadow, alpha: 0.35 });
}

/**
 * A tree, drawn around (0, 0) = the centre of its tile on the ground. Map objects add to `g`
 * without clearing it, so a row of them can share one Graphics (see `mapObjectRuns.ts`).
 */
export function drawTree(g: Graphics, amount: number, fullAmount: number): void {
  const s = TILE_H / 64; // art scale
  const fullness = 0.75 + 0.25 * (amount / fullAmount);
  groundShadow(g, 30 * s, 14 * s);
  g.poly(
    flat([
      { x: -7 * s, y: 0 },
      { x: -5 * s, y: -38 * s },
      { x: 5 * s, y: -38 * s },
      { x: 7 * s, y: 0 },
    ]),
  )
    .fill(palette.trunk)
    .stroke(INK);
  const r = 22 * s * fullness;
  g.circle(-15 * s, -46 * s, r)
    .fill(palette.canopyDark)
    .stroke(INK);
  g.circle(15 * s, -48 * s, r)
    .fill(palette.canopy)
    .stroke(INK);
  g.circle(0, -66 * s, r * 1.15)
    .fill(palette.canopyLight)
    .stroke(INK);
  // A few leaf strokes for texture.
  g.moveTo(-6 * s, -70 * s).lineTo(2 * s, -62 * s);
  g.moveTo(8 * s, -48 * s).lineTo(14 * s, -42 * s);
  g.stroke({ ...THIN_INK, alpha: 0.6 });
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

/** A stone Deposit, drawn like `drawTree`: a heap of grey boulders. */
export function drawStoneDeposit(g: Graphics): void {
  const s = TILE_H / 64;
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

/** A clay Deposit, drawn like `drawTree`: a dug, wet bank of red clay. */
export function drawClayDeposit(g: Graphics): void {
  const s = TILE_H / 64;
  g.ellipse(0, 0, 28 * s, 12 * s)
    .fill(palette.clayDark)
    .stroke(INK);
  g.ellipse(-4 * s, -4 * s, 18 * s, 7 * s).fill(palette.clay);
  g.ellipse(-8 * s, -6 * s, 6 * s, 2.5 * s).fill(palette.clayWet);
  g.ellipse(9 * s, 1 * s, 4 * s, 1.8 * s).fill(palette.clayWet);
}

/** An iron Deposit, drawn like `drawTree`: a dark outcrop on the Mountain, streaked with rust. */
export function drawIronDeposit(g: Graphics): void {
  const s = TILE_H / 64;
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

/** One lump of iron ore, centred on (x, y). */
function drawIronOre(g: Graphics, x: number, y: number, s: number): void {
  g.poly([x - 8 * s, y + 3 * s, x - 5 * s, y - 4 * s, x + 4 * s, y - 4.5 * s, x + 8 * s, y + 3 * s])
    .fill(palette.ironOre)
    .stroke(THIN_INK);
  g.circle(x + 1 * s, y - 1 * s, 1.8 * s).fill(palette.rust);
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

/** North and west walls face away from the isometric camera. */
export function isBackFace(face: DoorFace): boolean {
  return face === 'north' || face === 'west';
}

/**
 * A doorstep on the ground at `door`: where a door on a hidden back wall opens, and where a site's
 * door will be. Its long side runs along the wall.
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
 * A chopping block: a stump with an axe in it, wood chips where its worker stands at the door, the
 * firewood (`output`) piled on the door side and the logs waiting to be split (`input`) behind.
 * The axe handle leans towards the door.
 */
export function drawChoppingBlock(
  g: Graphics,
  layout: BuildingLayout,
  input: ResourceAmount | null,
  output: ResourceAmount | null,
): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin, door } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  // Grid direction from the block to its door; piles sit along it, clear of the stump.
  const dir = { x: door.x - origin.x, y: door.y - origin.y };
  const toward = (t: number): Vec =>
    gridToWorld(origin.x + 0.5 + dir.x * t, origin.y + 0.5 + dir.y * t);
  const piles: { at: Vec; goods: ResourceAmount }[] = [];
  if (output && output.amount > 0) piles.push({ at: toward(0.42), goods: output });
  if (input && input.amount > 0) piles.push({ at: toward(-0.42), goods: input });
  const drawPiles = (front: boolean) => {
    for (const p of piles) {
      if (p.at.y > c.y === front)
        drawGoodsPile(g, p.goods.resource, p.at.x, p.at.y, p.goods.amount);
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
 * roof, all in timber.
 */
export function drawWatchtower(g: Graphics, layout: BuildingLayout): void {
  g.clear();
  const s = TILE_H / 64;
  const { origin } = layout;
  const c = gridToWorld(origin.x + 0.5, origin.y + 0.5);
  g.ellipse(c.x, c.y, 26 * s, 11 * s).fill({ color: palette.shadow, alpha: 0.3 });
  const deck = c.y - 78 * s;
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

/** Placement preview: footprint tinted valid/invalid, plus the door tile outlined. */
export function drawPlacementGhost(g: Graphics, layout: BuildingLayout, valid: boolean): void {
  g.clear();
  const color = valid ? palette.valid : palette.invalid;
  const { origin, size, door } = layout;
  g.poly(flat(diamond(origin.x, origin.y, size.w, size.h)))
    .fill({ color, alpha: 0.45 })
    .stroke(INK);
  drawDoorstep(g, door, doorFace(layout));
  g.poly(flat(diamond(door.x, door.y)))
    .fill({ color, alpha: 0.15 })
    .stroke({ width: 2, color, alpha: 0.9 });
}

/** Road tiles on one tile: `open` says which of +x, +y, −x, −y also hold road. */
export interface RoadTile {
  x: number;
  y: number;
  open: [boolean, boolean, boolean, boolean];
}

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

/** Dirt paths: straight pieces, corners and junctions from each tile's open sides. */
export function drawRoads(g: Graphics, tiles: RoadTile[]): void {
  g.clear();
  for (const [pad, color] of [
    [0.06, palette.dirtDark],
    [0, palette.dirt],
  ] as const) {
    for (const t of tiles) {
      for (const [rx, ry, rw, rh] of roadRects(t, pad)) {
        g.poly(flat(diamond(t.x + rx, t.y + ry, rw, rh))).fill(color);
      }
    }
  }
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
}

/**
 * Status icons over a villager's head, drawn relative to its feet: a House struck through when
 * it's Homeless, "zzz" when it's Tired, an empty bowl when it's Hungry, a snowflake when it's
 * Cold, a haunch struck through
 * when a hunter comes back with no catch. Every icon that applies shows, side by side.
 */
export function drawVillagerStatus(g: Graphics, status: VillagerStatus): void {
  g.clear();
  const s = TILE_H / 64;
  const { homeless, tired, hungry, cold, noCatch } = status;
  const icons = [
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
    if (icon === 'homeless') {
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
 * A Hunting ground's rectangle of tiles outlined on the ground in its health `color`, with a
 * faint wash inside.
 */
export function drawHuntingGround(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  g.poly(flat(diamond(x, y, w, h)))
    .fill({ color, alpha: 0.1 })
    .stroke({ width: 4, color: palette.ink, alpha: 0.5, join: 'round' });
  g.poly(flat(diamond(x, y, w, h))).stroke({ width: 2.5, color, alpha: 0.9, join: 'round' });
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
