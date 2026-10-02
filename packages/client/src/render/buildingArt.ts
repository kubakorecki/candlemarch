// Building art: every kind of building is its own timber house, with a shape and props that say
// what it is at a glance. Same placeholder style as shapes.ts: bold ink, flat earthy fills.
//
// Buildings are drawn in grid coordinates plus a height: `at(gx, gy, z)` is grid point (gx, gy)
// raised `z` world pixels. Only the south and east walls face the camera, so only they are drawn;
// roofs go back to front.
import type { BuildingId } from '@candlemarch/content';
import type { BuildingLayout } from '@candlemarch/sim';
import type { Graphics } from 'pixi.js';
import { gridToWorld, TILE_H, type Vec } from './iso';
import { palette } from './palette';
import {
  type DoorFace,
  doorFace,
  doorway,
  drawGlow,
  flat,
  groundShadowAt,
  INK,
  isBackFace,
  lerp,
  ROOF_H,
  THIN_INK,
  up,
  WALL_H,
} from './shapes';

/** Art scale: 1 at the current tile size. */
const S = TILE_H / 64;
/** Height of one log in a log wall. */
const LOG_H = 9 * S;
const GRAIN = { width: 1.5 * S, color: palette.logSeam, alpha: 0.75, cap: 'round' } as const;

/** World point of grid point (gx, gy), `z` world pixels above the ground. */
function at(gx: number, gy: number, z = 0): Vec {
  return up(gridToWorld(gx, gy), z);
}

/** A building's body in grid coordinates, x0–x1 by y0–y1, inside its footprint. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The two walls that face the camera. */
type FrontWall = 'south' | 'east';

/**
 * The front wall a building's props lean on: the one across the door's axis, so they never block
 * the door, and a door on a back wall still leaves them in view.
 */
function propWall(face: DoorFace): FrontWall {
  return face === 'south' || face === 'north' ? 'east' : 'south';
}

/** The footprint shrunk by `pad` tiles on each side, and by `propPad` on the props' side. */
function bodyBox(layout: BuildingLayout, pad: number, propPad = pad): Box {
  const { origin, size } = layout;
  const wall = propWall(doorFace(layout));
  return {
    x0: origin.x + pad,
    y0: origin.y + pad,
    x1: origin.x + size.w - (wall === 'east' ? propPad : pad),
    y1: origin.y + size.h - (wall === 'south' ? propPad : pad),
  };
}

/** Ground ends of a front wall, left to right on screen. */
function wallEnds(box: Box, wall: FrontWall): [Vec, Vec] {
  return wall === 'south'
    ? [
        { x: box.x0, y: box.y1 },
        { x: box.x1, y: box.y1 },
      ]
    : [
        { x: box.x1, y: box.y1 },
        { x: box.x1, y: box.y0 },
      ];
}

/** A point by a front wall: `u` 0–1 along it (left to right), `out` tiles in front, `z` up. */
function wallPoint(box: Box, wall: FrontWall, u: number, out: number, z: number): Vec {
  const [a, b] = wallEnds(box, wall);
  const n = wall === 'south' ? { x: 0, y: out } : { x: out, y: 0 };
  return at(a.x + (b.x - a.x) * u + n.x, a.y + (b.y - a.y) * u + n.y, z);
}

/** Where the door sits along a front wall (0–1), or null when it's on another wall. */
function doorAlong(layout: BuildingLayout, box: Box, wall: FrontWall): number | null {
  const { face, sill } = doorway(layout);
  if (face !== wall) return null;
  return wall === 'south'
    ? (sill.x - box.x0) / (box.x1 - box.x0)
    : (box.y1 - sill.y) / (box.y1 - box.y0);
}

/** The top of a wall: (t along it 0–1, height) points, left to right. */
type Profile = [number, number][];

function flatTop(z: number): Profile {
  return [
    [0, z],
    [1, z],
  ];
}

function gableTop(eave: number, ridge: number): Profile {
  return [
    [0, eave],
    [0.5, ridge],
    [1, eave],
  ];
}

function topAt(profile: Profile, t: number): number {
  for (let i = 0; i < profile.length - 1; i++) {
    const [ta, za] = profile[i] as [number, number];
    const [tb, zb] = profile[i + 1] as [number, number];
    if (t <= tb) return za + ((zb - za) * (t - ta)) / (tb - ta);
  }
  return profile[profile.length - 1]?.[1] ?? 0;
}

/** The stretch of a wall whose top is at least `z` high, or null when none is. */
function spanAt(profile: Profile, z: number): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const take = (t: number) => {
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  };
  for (let i = 0; i < profile.length - 1; i++) {
    const [ta, za] = profile[i] as [number, number];
    const [tb, zb] = profile[i + 1] as [number, number];
    if (za >= z) take(ta);
    if (zb >= z) take(tb);
    if ((za - z) * (zb - z) < 0) take(ta + ((tb - ta) * (z - za)) / (zb - za));
  }
  return lo < hi ? [lo, hi] : null;
}

/** What a building's walls are made of: its lit and shaded colours, and logs or upright boards. */
interface Timber {
  light: number;
  dark: number;
  grain: 'logs' | 'boards';
}

const LOGS: Timber = { light: palette.logWall, dark: palette.logWallDark, grain: 'logs' };
const DRIFTWOOD: Timber = {
  light: palette.driftwood,
  dark: palette.driftwoodDark,
  grain: 'boards',
};
const PLANKS: Timber = { light: palette.plank, dark: palette.plankDark, grain: 'boards' };

/** A front wall from `z0` up to its `profile`: logs laid flat, or boards stood on end. */
function drawWall(
  g: Graphics,
  box: Box,
  wall: FrontWall,
  profile: Profile,
  timber: Timber,
  z0 = 0,
): void {
  const [a, b] = wallEnds(box, wall);
  const along = (t: number, z: number) => at(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, z);
  const outline = [
    along(0, z0),
    along(1, z0),
    ...[...profile].reverse().map(([t, z]) => along(t, z)),
  ];
  g.poly(flat(outline)).fill(wall === 'south' ? timber.light : timber.dark);
  if (timber.grain === 'logs') {
    for (let z = z0 + LOG_H; ; z += LOG_H) {
      const span = spanAt(profile, z);
      if (!span) break;
      const p = along(span[0], z);
      const q = along(span[1], z);
      g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    }
  } else {
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const boards = Math.max(3, Math.round(length / 0.13));
    for (let i = 1; i < boards; i++) {
      const t = i / boards;
      const p = along(t, z0);
      const q = along(t, topAt(profile, t));
      g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    }
  }
  g.stroke(GRAIN);
  g.poly(flat(outline)).stroke(INK);
}

/**
 * Log ends sticking out of a log wall's corner at grid point `p`, one per log from `z0` to `top`:
 * to the left (`side` −1), right (1), or alternating where two walls cross (0).
 */
function drawLogEnds(g: Graphics, p: Vec, z0: number, top: number, side: -1 | 0 | 1): void {
  for (let i = 0; z0 + (i + 1) * LOG_H <= top + 1; i++) {
    const c = at(p.x, p.y, z0 + (i + 0.5) * LOG_H);
    const dx = (side === 0 ? (i % 2 === 0 ? -1 : 1) : side) * 3 * S;
    g.circle(c.x + dx, c.y, LOG_H * 0.46)
      .fill(palette.logEnd)
      .stroke({ ...THIN_INK, width: 1.5 * S });
  }
}

/** The corners of a log body: left, front and right, each as high as the walls meeting there. */
function drawCorners(g: Graphics, box: Box, south: Profile, east: Profile, z0 = 0): void {
  drawLogEnds(g, { x: box.x0, y: box.y1 }, z0, topAt(south, 0), -1);
  drawLogEnds(g, { x: box.x1, y: box.y1 }, z0, Math.min(topAt(south, 1), topAt(east, 0)), 0);
  drawLogEnds(g, { x: box.x1, y: box.y0 }, z0, topAt(east, 1), 1);
}

/** A plank door on a front wall, from `z0` up `h`; a door on a back wall is hidden (`drawDoorstones`). */
function drawDoor(g: Graphics, layout: BuildingLayout, box: Box, z0: number, h: number): void {
  const face = doorFace(layout);
  if (isBackFace(face)) return;
  const wall = face as FrontWall;
  const u = doorAlong(layout, box, wall) ?? 0.5;
  const [a, b] = wallEnds(box, wall);
  const width = 0.24 / (Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
  const from = Math.max(0.06, u - width);
  const to = Math.min(0.94, u + width);
  const corners = [
    wallPoint(box, wall, from, 0, z0),
    wallPoint(box, wall, to, 0, z0),
    wallPoint(box, wall, to, 0, z0 + h),
    wallPoint(box, wall, from, 0, z0 + h),
  ];
  g.poly(flat(corners)).fill(palette.door).stroke(THIN_INK);
  const mid = (from + to) / 2;
  const p = wallPoint(box, wall, mid, 0, z0);
  const q = wallPoint(box, wall, mid, 0, z0 + h);
  g.moveTo(p.x, p.y)
    .lineTo(q.x, q.y)
    .stroke({ ...GRAIN, color: palette.ink });
  const knob = wallPoint(box, wall, mid + (to - from) * 0.3, 0, z0 + h * 0.5);
  g.circle(knob.x, knob.y, 1.5 * S).fill(palette.logEnd);
}

/**
 * The way in, on the ground: a flat doorstep against the door's wall and two stepping stones out
 * across the door tile. Drawn before the building, so a door on a hidden back wall shows as the
 * stones leading round behind it.
 */
function drawDoorstones(g: Graphics, layout: BuildingLayout): void {
  const { sill, out } = doorway(layout);
  // `a` along the wall, `o` out from it, in tiles from the sill.
  const ground = (a: number, o: number): Vec =>
    gridToWorld(sill.x - out.y * a + out.x * o, sill.y + out.x * a + out.y * o);
  const step = [ground(-0.17, -0.1), ground(0.17, -0.1), ground(0.17, 0.2), ground(-0.17, 0.2)];
  g.poly(flat(step)).fill(palette.stone).stroke(THIN_INK);
  const edge = [ground(-0.17, 0.2), ground(0.17, 0.2)] as const;
  g.moveTo(edge[0].x, edge[0].y)
    .lineTo(edge[1].x, edge[1].y)
    .stroke({ width: 2 * S, color: palette.stoneDark });
  for (const [a, o, r] of [
    [0.05, 0.42, 0.11],
    [-0.04, 0.7, 0.1],
  ] as const) {
    const stone = Array.from({ length: 10 }, (_, i) => {
      const t = (i / 10) * Math.PI * 2;
      return ground(a + Math.cos(t) * r * 1.2, o + Math.sin(t) * r);
    });
    g.poly(flat(stone)).fill(palette.stone).stroke(THIN_INK);
  }
}

/** How a roof is covered: its lit and shaded colours, and shingle rows or thatch straws. */
interface Roofing {
  light: number;
  dark: number;
  texture: 'shingles' | 'thatch';
}

const SHINGLES: Roofing = { light: palette.roof, dark: palette.roofDark, texture: 'shingles' };
const BARK: Roofing = { light: palette.barkRoof, dark: palette.barkRoofDark, texture: 'shingles' };
const THATCH: Roofing = { light: palette.thatch, dark: palette.thatchDark, texture: 'thatch' };
const REED: Roofing = { light: palette.reed, dark: palette.reedDark, texture: 'thatch' };
const BOARDS: Roofing = { light: palette.plank, dark: palette.plankDark, texture: 'shingles' };
const MOSS: Roofing = { light: palette.mossRoof, dark: palette.mossRoofDark, texture: 'shingles' };

/**
 * One roof slope, [eave start, eave end, ridge end, ridge start], filled and outlined, with
 * shingle rows along it or thatch straws running down it.
 */
function drawSlope(g: Graphics, slope: Vec[], fill: number, roofing: Roofing): void {
  const [ea, eb, rb, ra] = slope as [Vec, Vec, Vec, Vec];
  g.poly(flat(slope)).fill(fill);
  const line = { width: 1.5 * S, color: palette.ink, alpha: 0.35, cap: 'round' } as const;
  if (roofing.texture === 'shingles') {
    for (const f of [0.25, 0.5, 0.75]) {
      const p = lerp(ea, ra, f);
      const q = lerp(eb, rb, f);
      g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    }
  } else {
    const straws = 9;
    for (let i = 1; i < straws; i++) {
      const f = i / straws;
      const p = lerp(ea, eb, f);
      const q = lerp(lerp(ra, rb, f), p, 0.35);
      g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    }
  }
  g.stroke(line);
  g.poly(flat(slope)).stroke(INK);
}

/**
 * A gable roof over `box`, its ridge along grid `axis`: 'x' puts the gable on the east wall, 'y'
 * on the south wall. `back` is the slope turned away, `strip` its overhang past the front gable,
 * `front` the slope in view; `south` and `east` are the walls' tops, gable included.
 */
interface Gable {
  back: Vec[];
  strip: Vec[];
  front: Vec[];
  frontFill: 'light' | 'dark';
  south: Profile;
  east: Profile;
}

function gable(
  box: Box,
  axis: 'x' | 'y',
  eave: number,
  rise: number,
  overhang: number,
  eaveWalls = eave,
): Gable {
  const { x0, y0, x1, y1 } = box;
  const o = overhang;
  const ridge = eave + rise;
  if (axis === 'x') {
    const ym = (y0 + y1) / 2;
    const low = eave - (rise / (ym - y0)) * o;
    return {
      back: [
        at(x0 - o, y0 - o, low),
        at(x1 + o, y0 - o, low),
        at(x1 + o, ym, ridge),
        at(x0 - o, ym, ridge),
      ],
      strip: [
        at(x1, y0 - o, low),
        at(x1 + o, y0 - o, low),
        at(x1 + o, ym, ridge),
        at(x1, ym, ridge),
      ],
      front: [
        at(x0 - o, y1 + o, low),
        at(x1 + o, y1 + o, low),
        at(x1 + o, ym, ridge),
        at(x0 - o, ym, ridge),
      ],
      frontFill: 'light',
      south: flatTop(eaveWalls),
      east: gableTop(eave, ridge),
    };
  }
  const xm = (x0 + x1) / 2;
  const low = eave - (rise / (xm - x0)) * o;
  return {
    back: [
      at(x0 - o, y0 - o, low),
      at(x0 - o, y1 + o, low),
      at(xm, y1 + o, ridge),
      at(xm, y0 - o, ridge),
    ],
    strip: [at(x0 - o, y1, low), at(x0 - o, y1 + o, low), at(xm, y1 + o, ridge), at(xm, y1, ridge)],
    front: [
      at(x1 + o, y0 - o, low),
      at(x1 + o, y1 + o, low),
      at(xm, y1 + o, ridge),
      at(xm, y0 - o, ridge),
    ],
    frontFill: 'dark',
    south: gableTop(eave, ridge),
    east: flatTop(eaveWalls),
  };
}

/** The back slope of a gable roof; draw it before the walls. */
function drawGableBack(g: Graphics, roof: Gable, roofing: Roofing): void {
  g.poly(flat(roof.back)).fill(roofing.dark).stroke(INK);
}

/** The rest of a gable roof, after the walls: the back slope's overhang, the front slope, ridge. */
function drawGableFront(g: Graphics, roof: Gable, roofing: Roofing): void {
  g.poly(flat(roof.strip)).fill(roofing.dark).stroke(INK);
  drawSlope(g, roof.front, roofing[roof.frontFill], roofing);
  const [, , rb, ra] = roof.front as [Vec, Vec, Vec, Vec];
  g.moveTo(ra.x, ra.y)
    .lineTo(rb.x, rb.y)
    .stroke({ width: 7 * S, color: palette.ink, cap: 'round' });
  g.moveTo(ra.x, ra.y)
    .lineTo(rb.x, rb.y)
    .stroke({ width: 3.5 * S, color: roofing.dark, cap: 'round' });
}

/** A hip roof over `box` rising from `eave` to a point `rise` above it. */
function drawHipRoof(
  g: Graphics,
  box: Box,
  eave: number,
  rise: number,
  overhang: number,
  roofing: Roofing,
): void {
  const { x0, y0, x1, y1 } = box;
  const o = overhang;
  const low = eave - (rise / ((x1 - x0) / 2)) * o;
  const apex = at((x0 + x1) / 2, (y0 + y1) / 2, eave + rise);
  const nw = at(x0 - o, y0 - o, low);
  const ne = at(x1 + o, y0 - o, low);
  const se = at(x1 + o, y1 + o, low);
  const sw = at(x0 - o, y1 + o, low);
  g.poly(flat([sw, nw, apex]))
    .fill(roofing.dark)
    .stroke(INK);
  g.poly(flat([nw, ne, apex]))
    .fill(roofing.light)
    .stroke(INK);
  drawSlope(g, [sw, se, apex, apex], roofing.light, roofing);
  drawSlope(g, [se, ne, apex, apex], roofing.dark, roofing);
}

/** A small stone chimney standing at grid (gx, gy) from `z0` to `top`. */
function drawChimney(g: Graphics, gx: number, gy: number, z0: number, top: number): void {
  const w = 0.09;
  const sw = [
    at(gx - w, gy + w, z0),
    at(gx + w, gy + w, z0),
    at(gx + w, gy + w, top),
    at(gx - w, gy + w, top),
  ];
  const e = [
    at(gx + w, gy + w, z0),
    at(gx + w, gy - w, z0),
    at(gx + w, gy - w, top),
    at(gx + w, gy + w, top),
  ];
  const cap = [
    at(gx - w, gy - w, top),
    at(gx + w, gy - w, top),
    at(gx + w, gy + w, top),
    at(gx - w, gy + w, top),
  ];
  g.poly(flat(sw)).fill(palette.stone).stroke(INK);
  g.poly(flat(e)).fill(palette.stoneDark).stroke(INK);
  // Mortar courses.
  for (let z = top - 7 * S; z > z0; z -= 7 * S) {
    const a = at(gx - w, gy + w, z);
    const b = at(gx + w, gy + w, z);
    const c = at(gx + w, gy - w, z);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y);
  }
  g.stroke({ width: 1.2 * S, color: palette.ink, alpha: 0.4 });
  g.poly(flat(cap)).fill(palette.shadow).stroke(INK);
}

/** Wall height of a building `size` tiles across: bigger buildings stand a little taller. */
function wallHeight(size: { w: number; h: number }): number {
  return WALL_H * (0.8 + 0.2 * Math.max(size.w, size.h));
}

/**
 * A finished building in world coordinates, drawn as its own kind of timber house (a generic log
 * cabin for any kind without art yet). What it keeps inside (its Storage, a Granary's Food) isn't
 * drawn; a Workplace's goods are in its yard, drawn apart.
 */
export function drawBuilding(g: Graphics, layout: BuildingLayout, type: BuildingId): void {
  g.clear();
  const { origin, size } = layout;
  const c = gridToWorld(origin.x + size.w / 2, origin.y + size.h / 2);
  groundShadowAt(g, c.x, c.y, size.w * TILE_H * 0.62, size.h * TILE_H * 0.31);
  drawDoorstones(g, layout);
  if (type === 'hut') drawHut(g, layout);
  else if (type === 'woodcutters_hut') drawWoodcuttersHut(g, layout);
  else if (type === 'fishers_hut') drawFishersHut(g, layout);
  else if (type === 'foragers_hut') drawForagersHut(g, layout);
  else if (type === 'hunters_lodge') drawHuntersLodge(g, layout);
  else if (type === 'granary') drawGranary(g, layout);
  else if (type === 'village_hall') drawVillageHall(g, layout);
  else if (type === 'notice_board') drawNoticeBoard(g, layout);
  else if (type === 'farm') drawFarm(g, layout);
  else if (type === 'charcoal_kiln') drawCharcoalKiln(g, layout);
  else if (type === 'sawpit') drawSawpit(g, layout);
  else if (type === 'stonecutter') drawStonecutter(g, layout);
  else if (type === 'brick_kiln') drawBrickKiln(g, layout);
  else if (type === 'smokehouse') drawSmokehouse(g, layout);
  else if (type === 'bloomery') drawBloomery(g, layout);
  else if (type === 'brewery') drawBrewery(g, layout);
  else if (type === 'trade_post') drawTradePost(g, layout);
  else drawCabin(g, layout);
}

/** A plain log cabin under a hip roof. */
function drawCabin(g: Graphics, layout: BuildingLayout): void {
  const box = bodyBox(layout, 0.08);
  const h = wallHeight(layout.size);
  const top = flatTop(h);
  drawWall(g, box, 'south', top, LOGS);
  drawWall(g, box, 'east', top, LOGS);
  drawCorners(g, box, top, top);
  drawDoor(g, layout, box, 0, WALL_H * 0.7);
  drawHipRoof(
    g,
    box,
    h - 4 * S,
    ROOF_H * (0.7 + 0.3 * Math.max(layout.size.w, layout.size.h)),
    0.1,
    SHINGLES,
  );
}

// ---------------------------------------------------------------- Hut (a House)

const HUT_PAD = 0.12;
const HUT_EAVE = WALL_H * 0.85;

/** A Hut's ridge runs along its door wall, so the door is under the eaves. */
function hutAxis(face: DoorFace): 'x' | 'y' {
  return face === 'south' || face === 'north' ? 'x' : 'y';
}

/**
 * World corners of a House's window: mid-wall on the front wall its props go on (`propWall`),
 * which is never the door's.
 */
export function houseWindow(layout: BuildingLayout): [Vec, Vec, Vec, Vec] {
  const box = bodyBox(layout, HUT_PAD);
  const wall = propWall(doorFace(layout));
  const sill = HUT_EAVE * 0.3;
  const lintel = HUT_EAVE * 0.72;
  return [
    wallPoint(box, wall, 0.34, 0, sill),
    wallPoint(box, wall, 0.66, 0, sill),
    wallPoint(box, wall, 0.66, 0, lintel),
    wallPoint(box, wall, 0.34, 0, lintel),
  ];
}

/**
 * A lit House window: the pane in `palette.windowLit` and a small glow around it, with no lit
 * ground, so it never reads as the pool of Light a torch casts.
 */
export function drawWindowLight(g: Graphics, layout: BuildingLayout): void {
  const pane = houseWindow(layout);
  const [a, , c] = pane;
  const centre = lerp(a, c, 0.5);
  drawGlow(g, centre.x, centre.y, TILE_H * 0.45);
  g.poly(flat(pane)).fill(palette.windowLit);
}

/**
 * A Hut: a snug log cabin under a red shingle gable with a stone chimney, a shuttered window and
 * a flower box.
 */
function drawHut(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const box = bodyBox(layout, HUT_PAD);
  const axis = hutAxis(face);
  const roof = gable(box, axis, HUT_EAVE, ROOF_H * 0.9, 0.1);
  drawGableBack(g, roof, SHINGLES);
  drawWall(g, box, 'south', roof.south, LOGS);
  drawWall(g, box, 'east', roof.east, LOGS);
  drawCorners(g, box, flatTop(HUT_EAVE), flatTop(HUT_EAVE));
  drawDoor(g, layout, box, 0, WALL_H * 0.66);
  drawHutWindow(g, layout, box);
  // The chimney rises from the back slope, so the front slope hides its foot.
  const chimney =
    axis === 'x' ? { x: box.x0 + 0.2, y: box.y0 + 0.14 } : { x: box.x0 + 0.14, y: box.y0 + 0.2 };
  drawChimney(g, chimney.x, chimney.y, HUT_EAVE, HUT_EAVE + ROOF_H * 0.9 + 12 * S);
  drawGableFront(g, roof, SHINGLES);
}

/** The Hut's window (unlit; the lights layer lights it), shutters either side, a flower box under. */
function drawHutWindow(g: Graphics, layout: BuildingLayout, box: Box): void {
  const wall = propWall(doorFace(layout));
  const pane = houseWindow(layout);
  const [a, b, c, d] = pane;
  g.poly(flat(pane)).fill(palette.window).stroke(THIN_INK);
  const mid = [lerp(a, b, 0.5), lerp(d, c, 0.5)] as const;
  g.moveTo(mid[0].x, mid[0].y)
    .lineTo(mid[1].x, mid[1].y)
    .stroke({ ...THIN_INK, width: 1.5 * S });
  const sill = HUT_EAVE * 0.3;
  const lintel = HUT_EAVE * 0.72;
  for (const [u0, u1] of [
    [0.2, 0.33],
    [0.67, 0.8],
  ] as const) {
    g.poly(
      flat([
        wallPoint(box, wall, u0, 0, sill),
        wallPoint(box, wall, u1, 0, sill),
        wallPoint(box, wall, u1, 0, lintel),
        wallPoint(box, wall, u0, 0, lintel),
      ]),
    )
      .fill(palette.door)
      .stroke(THIN_INK);
  }
  // Flower box: a little trough of green with red flowers.
  const trough = [
    wallPoint(box, wall, 0.3, 0.06, sill - 6 * S),
    wallPoint(box, wall, 0.7, 0.06, sill - 6 * S),
    wallPoint(box, wall, 0.7, 0.06, sill),
    wallPoint(box, wall, 0.3, 0.06, sill),
  ];
  for (const u of [0.36, 0.46, 0.56, 0.64]) {
    const p = wallPoint(box, wall, u, 0.05, sill + 2 * S);
    g.circle(p.x, p.y, 3.2 * S)
      .fill(palette.herb)
      .stroke({ ...THIN_INK, width: 1.2 * S });
  }
  for (const u of [0.4, 0.52, 0.62]) {
    const p = wallPoint(box, wall, u, 0.05, sill + 4 * S);
    g.circle(p.x, p.y, 1.8 * S).fill(palette.flower);
  }
  g.poly(flat(trough)).fill(palette.plankDark).stroke(THIN_INK);
}

// ---------------------------------------------------------------- Woodcutter's hut

/**
 * A Woodcutter's hut: a small log house under a dark bark roof, a lean-to woodshed stacked with
 * logs on one side with an axe leant on it, and a two-man saw hung by the door.
 */
function drawWoodcuttersHut(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, HUT_PAD, 0.34);
  const eave = HUT_EAVE * 0.9;
  const roof = gable(box, hutAxis(face), eave, ROOF_H * 0.8, 0.1);
  drawGableBack(g, roof, BARK);
  drawWall(g, box, 'south', roof.south, LOGS);
  drawWall(g, box, 'east', roof.east, LOGS);
  drawCorners(g, box, flatTop(eave), flatTop(eave));
  drawDoor(g, layout, box, 0, WALL_H * 0.7);
  const other: FrontWall = wall === 'east' ? 'south' : 'east';
  const doorU = doorAlong(layout, box, other);
  drawSaw(g, box, other, doorU !== null && doorU < 0.5 ? 0.72 : 0.28, eave * 0.62);
  drawGableFront(g, roof, BARK);
  drawWoodshed(g, box, wall, eave);
}

/** A lean-to against `wall`: two posts, a bark roof, and log ends stacked under it. */
function drawWoodshed(g: Graphics, box: Box, wall: FrontWall, eave: number): void {
  const high = eave * 0.72;
  const low = eave * 0.42;
  const depth = 0.26;
  // Back of the stack in shadow, then the log ends in rows.
  g.poly(
    flat([
      wallPoint(box, wall, 0.08, 0.02, 0),
      wallPoint(box, wall, 0.92, 0.02, 0),
      wallPoint(box, wall, 0.92, 0.02, low),
      wallPoint(box, wall, 0.08, 0.02, low),
    ]),
  ).fill(palette.shadow);
  const r = 3.8 * S;
  for (let row = 0; (row + 1) * 2 * r <= low + 1; row++) {
    const z = r + row * 2 * r * 0.9;
    const shift = row % 2 === 0 ? 0 : 0.065;
    for (let u = 0.14 + shift; u <= 0.88; u += 0.13) {
      const p = wallPoint(box, wall, u, depth - 0.06, z);
      g.circle(p.x, p.y, r)
        .fill(palette.logEnd)
        .stroke({ ...THIN_INK, width: 1.4 * S });
      g.circle(p.x, p.y, r * 0.4).stroke({ width: 1 * S, color: palette.log });
    }
  }
  // An axe leant on the end of the stack.
  const foot = wallPoint(box, wall, 0.97, depth, 0);
  const grip = wallPoint(box, wall, 0.9, depth, low * 0.95);
  g.moveTo(foot.x, foot.y)
    .lineTo(grip.x, grip.y)
    .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
  g.moveTo(foot.x, foot.y)
    .lineTo(grip.x, grip.y)
    .stroke({ width: 2.5 * S, color: palette.log, cap: 'round' });
  g.poly([
    grip.x - 1 * S,
    grip.y - 3 * S,
    grip.x + 9 * S,
    grip.y - 7 * S,
    grip.x + 9 * S,
    grip.y + 5 * S,
    grip.x,
    grip.y + 3 * S,
  ])
    .fill(palette.axeHead)
    .stroke(THIN_INK);
  for (const u of [0.06, 0.94]) {
    const p = wallPoint(box, wall, u, depth, 0);
    const q = wallPoint(box, wall, u, depth, low + 2 * S);
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ width: 6 * S, color: palette.ink, cap: 'round' });
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ width: 3 * S, color: palette.log, cap: 'round' });
  }
  const o = 0.06;
  drawSlope(
    g,
    [
      wallPoint(box, wall, 1 + o, depth + o, low - 3 * S),
      wallPoint(box, wall, -o, depth + o, low - 3 * S),
      wallPoint(box, wall, -o, 0, high),
      wallPoint(box, wall, 1 + o, 0, high),
    ],
    wall === 'south' ? palette.plank : palette.plankDark,
    BOARDS,
  );
}

/** A two-man saw hung flat on `wall` at `u`, its teeth down, a handle at each end. */
function drawSaw(g: Graphics, box: Box, wall: FrontWall, u: number, z: number): void {
  const half = 0.2;
  const a = wallPoint(box, wall, u - half, 0, z);
  const b = wallPoint(box, wall, u + half, 0, z);
  const a2 = wallPoint(box, wall, u - half * 0.8, 0, z - 6 * S);
  const b2 = wallPoint(box, wall, u + half * 0.8, 0, z - 6 * S);
  g.poly(flat([a, b, b2, a2]))
    .fill(palette.axeHead)
    .stroke(THIN_INK);
  // Teeth.
  for (let i = 1; i < 9; i++) {
    const p = lerp(a2, b2, i / 9);
    g.moveTo(p.x - 1.5 * S, p.y)
      .lineTo(p.x, p.y + 2.5 * S)
      .lineTo(p.x + 1.5 * S, p.y);
  }
  g.stroke({ width: 1 * S, color: palette.ink });
  for (const p of [a, b]) {
    g.moveTo(p.x, p.y - 1 * S)
      .lineTo(p.x, p.y - 9 * S)
      .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(p.x, p.y - 1 * S)
      .lineTo(p.x, p.y - 9 * S)
      .stroke({ width: 2.5 * S, color: palette.log, cap: 'round' });
  }
}

// ---------------------------------------------------------------- Fisher's hut

/**
 * A Fisher's hut: a shack of grey weathered boards on short stilts under a sloping reed roof, a
 * net hung out to dry, fishing rods leant on the wall and a catch hung by the door.
 */
function drawFishersHut(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, 0.12, 0.22);
  const stilts = 10 * S;
  const low = stilts + WALL_H * 0.72;
  const rise = 24 * S;
  // The roof slopes down towards the door: high at the back wall.
  const toBack = (gx: number, gy: number): number => {
    if (face === 'south') return (box.y1 - gy) / (box.y1 - box.y0);
    if (face === 'north') return (gy - box.y0) / (box.y1 - box.y0);
    if (face === 'east') return (box.x1 - gx) / (box.x1 - box.x0);
    return (gx - box.x0) / (box.x1 - box.x0);
  };
  const zAt = (gx: number, gy: number) => low + rise * toBack(gx, gy);
  const south: Profile = [
    [0, zAt(box.x0, box.y1)],
    [1, zAt(box.x1, box.y1)],
  ];
  const east: Profile = [
    [0, zAt(box.x1, box.y1)],
    [1, zAt(box.x1, box.y0)],
  ];

  // Stilts and the deck edge they hold up.
  for (const [gx, gy] of [
    [box.x0 + 0.04, box.y1 - 0.02],
    [box.x1 - 0.02, box.y1 - 0.02],
    [box.x1 - 0.02, box.y0 + 0.04],
  ] as const) {
    const p = at(gx, gy, 0);
    const q = at(gx, gy, stilts);
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ width: 6 * S, color: palette.ink, cap: 'round' });
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ width: 3 * S, color: palette.driftwoodDark, cap: 'round' });
  }
  drawWall(g, box, 'south', south, DRIFTWOOD, stilts);
  drawWall(g, box, 'east', east, DRIFTWOOD, stilts);
  drawDoor(g, layout, box, stilts, WALL_H * 0.6);

  const o = 0.08;
  const corner = (gx: number, gy: number) => at(gx, gy, zAt(gx, gy));
  const roof = [
    corner(box.x0 - o, box.y1 + o),
    corner(box.x1 + o, box.y1 + o),
    corner(box.x1 + o, box.y0 - o),
    corner(box.x0 - o, box.y0 - o),
  ];
  // Eave edges first, so the roof reads as a thick reed mat.
  g.poly(flat(roof.map((p) => up(p, -4 * S))))
    .fill(palette.reedDark)
    .stroke(INK);
  const [sw, se, ne, nw] = roof as [Vec, Vec, Vec, Vec];
  const slope =
    face === 'south'
      ? [sw, se, ne, nw]
      : face === 'north'
        ? [ne, nw, sw, se]
        : face === 'east'
          ? [se, ne, nw, sw]
          : [nw, sw, se, ne];
  drawSlope(g, slope, palette.reed, REED);

  const other: FrontWall = wall === 'east' ? 'south' : 'east';
  const doorU = doorAlong(layout, box, other);
  drawHangingFish(
    g,
    box,
    other,
    doorU !== null && doorU < 0.5 ? 0.84 : 0.16,
    stilts + WALL_H * 0.62,
  );
  drawNet(g, box, wall, stilts, low);
  drawRods(g, box, wall, low + rise * 0.5);
}

/**
 * A net hung to dry over a pole on two posts just out from `wall`: a diamond mesh sagging between
 * them, cork floats along its foot.
 */
function drawNet(g: Graphics, box: Box, wall: FrontWall, z0: number, top: number): void {
  const out = 0.1;
  const u0 = 0.08;
  const u1 = 0.72;
  const bar = top - 4 * S;
  const posts: [Vec, Vec][] = [u0, u1].map((u) => [
    wallPoint(box, wall, u, out, 0),
    wallPoint(box, wall, u, out, bar + 3 * S),
  ]);
  const cols = 7;
  const rows = 4;
  const point = (i: number, j: number): Vec => {
    const f = i / cols;
    const u = u0 + 0.03 + (u1 - u0 - 0.06) * f;
    const drop = (bar - z0 - 6 * S) * (0.75 + 0.25 * Math.sin(Math.PI * f));
    return wallPoint(box, wall, u, out + 0.02, bar - (drop * j) / rows);
  };
  // A diamond mesh: both diagonals of every cell.
  const mesh = () => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = point(i, j);
        const b = point(i + 1, j + 1);
        const c = point(i + 1, j);
        const d = point(i, j + 1);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).moveTo(c.x, c.y).lineTo(d.x, d.y);
      }
    }
    const foot = point(0, rows);
    g.moveTo(foot.x, foot.y);
    for (let i = 1; i <= cols; i++) g.lineTo(point(i, rows).x, point(i, rows).y);
  };
  mesh();
  g.stroke({ width: 2.6 * S, color: palette.ink, alpha: 0.5, join: 'round' });
  mesh();
  g.stroke({ width: 1.2 * S, color: palette.rope, join: 'round' });
  for (let i = 1; i < cols; i += 2) {
    const p = point(i, rows);
    g.ellipse(p.x, p.y, 3.2 * S, 2.3 * S)
      .fill(palette.float)
      .stroke({ ...THIN_INK, width: 1.2 * S });
  }
  const pole = [
    wallPoint(box, wall, u0 - 0.05, out, bar),
    wallPoint(box, wall, u1 + 0.05, out, bar),
  ] as const;
  for (const [p, q] of [...posts, pole]) g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  g.stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
  for (const [p, q] of [...posts, pole]) g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  g.stroke({ width: 2.5 * S, color: palette.driftwoodDark, cap: 'round' });
}

/** Two fishing rods leant on `wall`, lines hanging from their tips. */
function drawRods(g: Graphics, box: Box, wall: FrontWall, top: number): void {
  for (const [u, lean] of [
    [0.78, 0.1],
    [0.9, 0.04],
  ] as const) {
    const foot = wallPoint(box, wall, u, 0.26, 0);
    const tip = wallPoint(box, wall, u + lean, 0.02, top + 10 * S);
    g.moveTo(foot.x, foot.y)
      .lineTo(tip.x, tip.y)
      .stroke({ width: 4 * S, color: palette.ink, cap: 'round' });
    g.moveTo(foot.x, foot.y)
      .lineTo(tip.x, tip.y)
      .stroke({ width: 2 * S, color: palette.log, cap: 'round' });
    g.moveTo(tip.x, tip.y)
      .quadraticCurveTo(tip.x + 3 * S, tip.y + 12 * S, tip.x + 2 * S, tip.y + 22 * S)
      .stroke({ width: 1 * S, color: palette.rope });
  }
}

/** Two fish hung head down from a peg on `wall` at `u`. */
function drawHangingFish(g: Graphics, box: Box, wall: FrontWall, u: number, z: number): void {
  const peg = wallPoint(box, wall, u, 0.02, z);
  for (const dx of [-4, 4]) {
    const x = peg.x + dx * S;
    const y = peg.y + 4 * S;
    g.moveTo(peg.x, peg.y)
      .lineTo(x, y)
      .stroke({ width: 1 * S, color: palette.rope });
    g.poly([x - 3.5 * S, y, x + 3.5 * S, y, x, y + 4 * S])
      .fill(palette.fish)
      .stroke({ ...THIN_INK, width: 1.4 * S });
    g.ellipse(x, y + 10 * S, 3.2 * S, 7 * S)
      .fill(palette.fish)
      .stroke({ ...THIN_INK, width: 1.4 * S });
    g.ellipse(x + 1 * S, y + 10 * S, 1.2 * S, 5 * S).fill(palette.fishBelly);
  }
  g.circle(peg.x, peg.y, 1.8 * S).fill(palette.door);
}

// ---------------------------------------------------------------- Forager's hut

/**
 * A Forager's hut: a round hut of upright stakes under a tall cone of thatch, herbs hung to dry
 * under the eaves, and baskets of berries and mushrooms by the wall.
 */
function drawForagersHut(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const box = bodyBox(layout, 0.14);
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const r = (box.x1 - box.x0) / 2;
  const wallH = WALL_H * 0.66;
  const eave = wallH - 2 * S;
  const apexZ = wallH + ROOF_H * 1.05;
  const ring = (radius: number, z: number, phi: number) =>
    at(cx + radius * Math.cos(phi), cy + radius * Math.sin(phi), z);
  // The front half, from the leftmost point on screen (grid direction 135°) round to the rightmost.
  const N = 16;
  const front = (from: number, to: number, radius: number, z: number): Vec[] =>
    Array.from({ length: N + 1 }, (_, i) => ring(radius, z, from + ((to - from) * i) / N));
  const LEFT = (3 * Math.PI) / 4;
  const MID = Math.PI / 4;
  const RIGHT = -Math.PI / 4;

  for (const [from, to, fill] of [
    [LEFT, MID, palette.logWall],
    [MID, RIGHT, palette.logWallDark],
  ] as const) {
    const base = front(from, to, r, 0);
    const top = front(from, to, r, wallH).reverse();
    g.poly(flat([...base, ...top])).fill(fill);
  }
  // Upright stakes.
  for (let i = 1; i < 12; i++) {
    const phi = LEFT + ((RIGHT - LEFT) * i) / 12;
    const p = ring(r, 0, phi);
    const q = ring(r, wallH, phi);
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  }
  g.stroke(GRAIN);
  g.poly(flat([...front(LEFT, RIGHT, r, 0), ...front(LEFT, RIGHT, r, wallH).reverse()])).stroke(
    INK,
  );

  // Door, on the curve where it faces.
  if (!isBackFace(face)) {
    const { out } = doorway(layout);
    const phi = Math.atan2(out.y, out.x);
    const w = 0.34;
    const dh = WALL_H * 0.56;
    const door = [
      ring(r, 0, phi - w),
      ring(r, 0, phi + w),
      ring(r, dh, phi + w),
      ring(r, dh, phi - w),
    ];
    g.poly(flat(door)).fill(palette.door).stroke(THIN_INK);
  }
  const wall = propWall(face);
  drawBaskets(g, box, wall);

  // Cone of thatch, lit on the left, shaded on the right, straws running to the peak.
  const apex = at(cx, cy, apexZ);
  const eaveR = r + 0.12;
  for (const [from, to, fill] of [
    [LEFT, MID, palette.thatch],
    [MID, RIGHT, palette.thatchDark],
  ] as const) {
    g.poly(flat([apex, ...front(from, to, eaveR, eave)])).fill(fill);
  }
  for (let i = 1; i < 14; i++) {
    const p = ring(eaveR, eave, LEFT + ((RIGHT - LEFT) * i) / 14);
    const q = lerp(p, apex, 0.55);
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  }
  g.stroke({ width: 1.5 * S, color: palette.ink, alpha: 0.35, cap: 'round' });
  g.poly(flat([apex, ...front(LEFT, RIGHT, eaveR, eave)])).stroke(INK);
  // A tied-off tuft and a couple of poles poking out of the peak.
  g.moveTo(apex.x - 7 * S, apex.y - 9 * S)
    .lineTo(apex.x + 3 * S, apex.y + 4 * S)
    .moveTo(apex.x + 7 * S, apex.y - 9 * S)
    .lineTo(apex.x - 3 * S, apex.y + 4 * S)
    .stroke({ width: 4.5 * S, color: palette.ink, cap: 'round' });
  g.moveTo(apex.x - 7 * S, apex.y - 9 * S)
    .lineTo(apex.x + 3 * S, apex.y + 4 * S)
    .moveTo(apex.x + 7 * S, apex.y - 9 * S)
    .lineTo(apex.x - 3 * S, apex.y + 4 * S)
    .stroke({ width: 2 * S, color: palette.log, cap: 'round' });
  const band = ring(0.02, apexZ - 12 * S, 0);
  g.ellipse(band.x, band.y, 5 * S, 2 * S)
    .fill(palette.thatchDark)
    .stroke({ ...THIN_INK, width: 1.4 * S });

  // Bunches of herbs hung under the eaves on the lit side.
  for (const phi of [LEFT - 0.55, LEFT - 1.05]) {
    const p = ring(eaveR - 0.03, eave - 1 * S, phi);
    g.moveTo(p.x, p.y)
      .lineTo(p.x, p.y + 5 * S)
      .stroke({ width: 1 * S, color: palette.rope });
    g.poly([
      p.x - 4 * S,
      p.y + 5 * S,
      p.x + 4 * S,
      p.y + 5 * S,
      p.x + 1.5 * S,
      p.y + 16 * S,
      p.x - 1.5 * S,
      p.y + 16 * S,
    ])
      .fill(palette.herb)
      .stroke({ ...THIN_INK, width: 1.4 * S });
  }
}

/** Two baskets on the ground by `wall`, one of berries and one of mushrooms. */
function drawBaskets(g: Graphics, box: Box, wall: FrontWall): void {
  const spots = [
    { u: 0.62, out: 0.05, fruit: 'berries' },
    { u: 0.92, out: 0.14, fruit: 'mushrooms' },
  ] as const;
  for (const { u, out, fruit } of spots) {
    const c = wallPoint(box, wall, u, out, 0);
    const w = 9 * S;
    const h = 9 * S;
    // Handle, then the wicker body, then what's heaped in it.
    g.moveTo(c.x - w * 0.8, c.y - h)
      .quadraticCurveTo(c.x, c.y - h - 14 * S, c.x + w * 0.8, c.y - h)
      .stroke({ width: 4 * S, color: palette.ink, cap: 'round' });
    g.moveTo(c.x - w * 0.8, c.y - h)
      .quadraticCurveTo(c.x, c.y - h - 14 * S, c.x + w * 0.8, c.y - h)
      .stroke({ width: 2 * S, color: palette.basket, cap: 'round' });
    if (fruit === 'berries') {
      for (const [dx, dy] of [
        [-4, -1],
        [0, -3],
        [4, -1],
        [-2, 1],
        [2, 1],
      ] as const) {
        g.circle(c.x + dx * S, c.y - h + dy * S, 2.6 * S)
          .fill(palette.berry)
          .stroke({ ...THIN_INK, width: 1 * S });
      }
    } else {
      for (const dx of [-4, 3]) {
        g.ellipse(c.x + dx * S, c.y - h - 1 * S, 4.5 * S, 3 * S)
          .fill(palette.mushroomCap)
          .stroke({ ...THIN_INK, width: 1.2 * S });
      }
    }
    g.poly([c.x - w, c.y - h, c.x + w, c.y - h, c.x + w * 0.75, c.y, c.x - w * 0.75, c.y])
      .fill(palette.basket)
      .stroke(THIN_INK);
    g.moveTo(c.x - w * 0.9, c.y - h * 0.5)
      .lineTo(c.x + w * 0.9, c.y - h * 0.5)
      .stroke({ width: 1.2 * S, color: palette.basketDark });
  }
}

// ---------------------------------------------------------------- Hunter's lodge

/**
 * A Hunter's lodge: a steep A-frame of logs whose roof comes down to the ground, antlers over the
 * gable door, and a hide stretched to dry on a frame beside it.
 */
function drawHuntersLodge(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const box = bodyBox(layout, 0.12, 0.2);
  // The ridge runs away from the door, so the door is in the gable end.
  const axis = face === 'south' || face === 'north' ? 'y' : 'x';
  const eave = 7 * S;
  const rise = WALL_H * 1.45;
  const roof = gable(box, axis, eave, rise, 0.07);
  drawGableBack(g, roof, MOSS);
  drawWall(g, box, 'south', roof.south, LOGS);
  drawWall(g, box, 'east', roof.east, LOGS);
  drawDoor(g, layout, box, 0, WALL_H * 0.64);
  drawGableFront(g, roof, MOSS);
  const gableWall: FrontWall = axis === 'y' ? 'south' : 'east';
  drawAntlers(g, wallPoint(box, gableWall, 0.5, 0.04, eave + rise * 0.62));
  drawHideFrame(g, box, propWall(face));
}

/** A pale skull with a pair of branching antlers, centred on `c`. */
function drawAntlers(g: Graphics, c: Vec): void {
  const tines: Vec[][] = [
    [
      { x: 0, y: 0 },
      { x: 8, y: -6 },
      { x: 13, y: -16 },
    ],
    [
      { x: 8, y: -6 },
      { x: 16, y: -8 },
    ],
    [
      { x: 11, y: -12 },
      { x: 8, y: -19 },
    ],
  ];
  const path = (side: 1 | -1) => {
    for (const tine of tines) {
      const [first, ...rest] = tine as [Vec, ...Vec[]];
      g.moveTo(c.x + side * (first.x + 2) * S, c.y + first.y * S);
      for (const p of rest) g.lineTo(c.x + side * (p.x + 2) * S, c.y + p.y * S);
    }
  };
  path(1);
  path(-1);
  g.stroke({ width: 5 * S, color: palette.ink, cap: 'round', join: 'round' });
  path(1);
  path(-1);
  g.stroke({ width: 2.5 * S, color: palette.bone, cap: 'round', join: 'round' });
  g.poly([
    c.x - 5 * S,
    c.y - 3 * S,
    c.x + 5 * S,
    c.y - 3 * S,
    c.x + 2.5 * S,
    c.y + 8 * S,
    c.x - 2.5 * S,
    c.y + 8 * S,
  ])
    .fill(palette.bone)
    .stroke({ ...THIN_INK, width: 1.5 * S });
  g.circle(c.x - 2 * S, c.y + 1 * S, 1.2 * S).fill(palette.ink);
  g.circle(c.x + 2 * S, c.y + 1 * S, 1.2 * S).fill(palette.ink);
}

/** A hide laced into a square pole frame standing just out from `wall`. */
function drawHideFrame(g: Graphics, box: Box, wall: FrontWall): void {
  const out = 0.16;
  const u0 = 0.2;
  const u1 = 0.85;
  const bottom = 4 * S;
  const top = 46 * S;
  const corner = (u: number, z: number) => wallPoint(box, wall, u, out, z);
  // A pelt spread out, a leg reaching to each corner of the frame, laced to it at the feet.
  const mu = (u0 + u1) / 2;
  const mz = (top + bottom) / 2;
  const w = u1 - u0;
  const h = top - bottom;
  const pelt: [number, number][] = [
    [-0.36, 0.42],
    [-0.14, 0.3],
    [0, 0.36],
    [0.14, 0.3],
    [0.36, 0.42],
    [0.22, 0.14],
    [0.26, -0.14],
    [0.36, -0.42],
    [0.14, -0.3],
    [0, -0.38],
    [-0.14, -0.3],
    [-0.36, -0.42],
    [-0.26, -0.14],
    [-0.22, 0.14],
  ];
  const hide = pelt.map(([du, dz]) => corner(mu + du * w, mz + dz * h));
  g.poly(flat(hide)).fill(palette.hide).stroke(THIN_INK);
  const spine = [corner(mu, mz + 0.3 * h), corner(mu, mz - 0.3 * h)] as const;
  g.moveTo(spine[0].x, spine[0].y)
    .lineTo(spine[1].x, spine[1].y)
    .stroke({ width: 3 * S, color: palette.hideDark, cap: 'round' });
  for (const [du, dz] of [
    [-0.36, 0.42],
    [0.36, 0.42],
    [0.36, -0.42],
    [-0.36, -0.42],
  ] as const) {
    const p = corner(mu + du * w, mz + dz * h);
    const q = corner(mu + Math.sign(du) * 0.5 * w, mz + Math.sign(dz) * 0.5 * h);
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  }
  g.stroke({ width: 1.2 * S, color: palette.rope });
  // The frame: two posts and two cross bars.
  const bars: [Vec, Vec][] = [
    [corner(u0, 0), corner(u0, top + 4 * S)],
    [corner(u1, 0), corner(u1, top + 4 * S)],
    [corner(u0 - 0.04, top), corner(u1 + 0.04, top)],
    [corner(u0 - 0.04, bottom), corner(u1 + 0.04, bottom)],
  ];
  for (const [p, q] of bars) g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  g.stroke({ width: 5.5 * S, color: palette.ink, cap: 'round' });
  for (const [p, q] of bars) g.moveTo(p.x, p.y).lineTo(q.x, q.y);
  g.stroke({ width: 2.8 * S, color: palette.log, cap: 'round' });
}

// ---------------------------------------------------------------- Granary

/**
 * A Granary: a tall plank store raised on mushroom-shaped staddle stones to keep the damp and
 * vermin out, under a steep thatched roof, with steps up to its door and grain sacks by the wall.
 */
function drawGranary(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const box = bodyBox(layout, 0.14, 0.3);
  const raised = 20 * S;
  const wallTop = raised + wallHeight(layout.size) * 0.95;
  // Staddle stones under the front corners and between them.
  const stones: [number, number][] = [
    [box.x0 + 0.08, box.y1 - 0.06],
    [(box.x0 + box.x1) / 2, box.y1 - 0.06],
    [box.x1 - 0.06, box.y1 - 0.06],
    [box.x1 - 0.06, (box.y0 + box.y1) / 2],
    [box.x1 - 0.06, box.y0 + 0.08],
  ];
  g.poly(
    flat([
      at(box.x0, box.y1, 0),
      at(box.x1, box.y1, 0),
      at(box.x1, box.y0, 0),
      at(box.x1, box.y0, raised),
      at(box.x1, box.y1, raised),
      at(box.x0, box.y1, raised),
    ]),
  ).fill({ color: palette.shadow, alpha: 0.6 });
  for (const [gx, gy] of stones) drawStaddleStone(g, at(gx, gy, 0), raised);
  const top = flatTop(wallTop);
  drawWall(g, box, 'south', top, PLANKS, raised);
  drawWall(g, box, 'east', top, PLANKS, raised);
  // A beam along the floor line and the eaves.
  for (const z of [raised, wallTop - 3 * S]) {
    const p = at(box.x0, box.y1, z);
    const q = at(box.x1, box.y1, z);
    const r = at(box.x1, box.y0, z);
    g.moveTo(p.x, p.y).lineTo(q.x, q.y).lineTo(r.x, r.y);
  }
  g.stroke({ width: 5 * S, color: palette.logSeam, cap: 'round', join: 'round' });
  drawDoor(g, layout, box, raised, WALL_H * 0.66);
  if (!isBackFace(face)) drawSteps(g, layout, box, face as FrontWall, raised);
  const wall = propWall(face);
  // A loft hatch high on the side wall, its shutter hooked open.
  const hatch = (u: number, z: number) => wallPoint(box, wall, u, 0, z);
  const z0 = wallTop - 30 * S;
  const z1 = wallTop - 10 * S;
  g.poly(flat([hatch(0.42, z0), hatch(0.58, z0), hatch(0.58, z1), hatch(0.42, z1)]))
    .fill(palette.window)
    .stroke(THIN_INK);
  g.poly(flat([hatch(0.58, z0), hatch(0.7, z0 - 2 * S), hatch(0.7, z1 - 2 * S), hatch(0.58, z1)]))
    .fill(palette.door)
    .stroke(THIN_INK);
  drawSacks(g, box, wall);
  drawHipRoof(g, box, wallTop, ROOF_H * 1.15, 0.1, THATCH);
}

/** A staddle stone standing at `foot`, its round cap `h` high. */
function drawStaddleStone(g: Graphics, foot: Vec, h: number): void {
  g.poly([
    foot.x - 5 * S,
    foot.y,
    foot.x + 5 * S,
    foot.y,
    foot.x + 3 * S,
    foot.y - h + 3 * S,
    foot.x - 3 * S,
    foot.y - h + 3 * S,
  ])
    .fill(palette.stone)
    .stroke(THIN_INK);
  g.ellipse(foot.x, foot.y - h + 2 * S, 9 * S, 3.5 * S)
    .fill(palette.stoneDark)
    .stroke(THIN_INK);
}

/** Wooden steps from the ground up to a raised door on `wall`. */
function drawSteps(
  g: Graphics,
  layout: BuildingLayout,
  box: Box,
  wall: FrontWall,
  h: number,
): void {
  const u = doorAlong(layout, box, wall) ?? 0.5;
  const [a, b] = wallEnds(box, wall);
  const half = 0.22 / (Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
  const steps = 2;
  for (let i = 0; i < steps; i++) {
    const z = (h * (steps - i)) / (steps + 1);
    const out = 0.1 + i * 0.1;
    const lit = wall === 'south' ? palette.plank : palette.plankDark;
    const tread = [
      wallPoint(box, wall, u - half, out - 0.1, z),
      wallPoint(box, wall, u + half, out - 0.1, z),
      wallPoint(box, wall, u + half, out, z),
      wallPoint(box, wall, u - half, out, z),
    ];
    const riser = [
      wallPoint(box, wall, u - half, out, z),
      wallPoint(box, wall, u + half, out, z),
      wallPoint(box, wall, u + half, out, 0),
      wallPoint(box, wall, u - half, out, 0),
    ];
    g.poly(flat(riser)).fill(lit).stroke(THIN_INK);
    g.poly(flat(tread)).fill(palette.logEnd).stroke(THIN_INK);
  }
}

/** Grain sacks slumped against `wall`. */
function drawSacks(g: Graphics, box: Box, wall: FrontWall): void {
  for (const [u, out] of [
    [0.55, 0.12],
    [0.7, 0.1],
    [0.63, 0.2],
  ] as const) {
    const c = wallPoint(box, wall, u, out, 0);
    g.poly([
      c.x - 7 * S,
      c.y,
      c.x - 8 * S,
      c.y - 10 * S,
      c.x - 4 * S,
      c.y - 17 * S,
      c.x + 4 * S,
      c.y - 17 * S,
      c.x + 8 * S,
      c.y - 10 * S,
      c.x + 7 * S,
      c.y,
    ])
      .fill(palette.sack)
      .stroke(THIN_INK);
    g.moveTo(c.x - 4 * S, c.y - 16 * S)
      .lineTo(c.x + 4 * S, c.y - 16 * S)
      .stroke({ width: 2 * S, color: palette.sackDark });
    g.moveTo(c.x - 3 * S, c.y - 17 * S)
      .lineTo(c.x - 5 * S, c.y - 21 * S)
      .moveTo(c.x + 3 * S, c.y - 17 * S)
      .lineTo(c.x + 5 * S, c.y - 21 * S)
      .stroke({ width: 1.5 * S, color: palette.ink });
  }
}

// ---------------------------------------------------------------- Farm

/**
 * The farm: a plank barn under a steep thatched gable, its ridge across the door so the door is in
 * the gable end, with grain sacks propped against its side.
 */
function drawFarm(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const box = bodyBox(layout, 0.1);
  const axis = face === 'south' || face === 'north' ? 'y' : 'x';
  const eave = wallHeight(layout.size) * 0.85;
  const roof = gable(box, axis, eave, ROOF_H * 1.5, 0.1);
  drawGableBack(g, roof, THATCH);
  drawWall(g, box, 'south', roof.south, PLANKS);
  drawWall(g, box, 'east', roof.east, PLANKS);
  drawCorners(g, box, flatTop(eave), flatTop(eave));
  drawDoor(g, layout, box, 0, WALL_H * 0.85);
  drawSacks(g, box, propWall(face));
  drawGableFront(g, roof, THATCH);
}

// ---------------------------------------------------------------- Charcoal kiln

/**
 * The charcoal kiln: a squat dome of clay-daubed earth on a ring of stones, a dark arched mouth
 * facing its door and smoke curling from the vent on top.
 */
function drawCharcoalKiln(g: Graphics, layout: BuildingLayout): void {
  const { origin, size } = layout;
  const c = at(origin.x + size.w / 2, origin.y + size.h / 2, 0);
  const rx = TILE_H * 0.62;
  const ry = rx / 2;
  const h = WALL_H * 1.05;
  // The stone ring, then the dome over it.
  g.ellipse(c.x, c.y, rx + 3 * S, ry + 2 * S)
    .fill(palette.stoneDark)
    .stroke(INK);
  g.moveTo(c.x - rx, c.y)
    .bezierCurveTo(c.x - rx, c.y - h * 1.2, c.x + rx, c.y - h * 1.2, c.x + rx, c.y)
    .arc(c.x, c.y, rx, 0, Math.PI)
    .closePath()
    .fill(palette.clay)
    .stroke(INK);
  // Shade on the camera's right, the darker side.
  g.moveTo(c.x + rx * 0.2, c.y - h * 0.88)
    .bezierCurveTo(
      c.x + rx * 0.8,
      c.y - h * 0.8,
      c.x + rx,
      c.y - h * 0.3,
      c.x + rx * 0.9,
      c.y + ry * 0.4,
    )
    .stroke({ width: 4 * S, color: palette.clayDark, alpha: 0.7, cap: 'round' });
  // The mouth, on the door's side of the dome.
  const { sill } = doorway(layout);
  const m = lerp(c, at(sill.x, sill.y, 0), 0.75);
  g.moveTo(m.x - 7 * S, m.y)
    .lineTo(m.x - 7 * S, m.y - 9 * S)
    .arc(m.x, m.y - 9 * S, 7 * S, Math.PI, 0)
    .lineTo(m.x + 7 * S, m.y)
    .closePath()
    .fill(palette.door)
    .stroke(INK);
  // The vent and its smoke.
  const top = { x: c.x, y: c.y - h * 0.9 };
  g.ellipse(top.x, top.y, 6 * S, 3 * S)
    .fill(palette.charcoal)
    .stroke(THIN_INK);
  g.moveTo(top.x, top.y - 2 * S)
    .bezierCurveTo(
      top.x - 8 * S,
      top.y - 12 * S,
      top.x + 8 * S,
      top.y - 18 * S,
      top.x + 2 * S,
      top.y - 30 * S,
    )
    .stroke({ width: 5 * S, color: palette.smoke, alpha: 0.55, cap: 'round' });
}

// ---------------------------------------------------------------- Tier-1 master workshops

/** A stroke from `a` to `b` with an ink edge: a post, pole or log seen from the side. */
function stick(g: Graphics, a: Vec, b: Vec, width: number, color: number): void {
  g.moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .stroke({ width: width + 3 * S, color: palette.ink, cap: 'round' });
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, cap: 'round' });
}

/** Smoke curling up from `p`. */
function drawSmoke(g: Graphics, p: Vec): void {
  g.moveTo(p.x, p.y - 2 * S)
    .bezierCurveTo(p.x - 8 * S, p.y - 12 * S, p.x + 8 * S, p.y - 18 * S, p.x + 2 * S, p.y - 30 * S)
    .stroke({ width: 5 * S, color: palette.smoke, alpha: 0.55, cap: 'round' });
}

/**
 * The sawpit: an open pit along the footprint's length, a log laid across trestles over it with
 * the frame saw standing in its cut, and sawdust heaped at the pit's edge.
 */
function drawSawpit(g: Graphics, layout: BuildingLayout): void {
  const { origin, size } = layout;
  const long: 'x' | 'y' = size.w >= size.h ? 'x' : 'y';
  const x0 = origin.x + 0.18;
  const y0 = origin.y + 0.18;
  const x1 = origin.x + size.w - 0.18;
  const y1 = origin.y + size.h - 0.18;
  // The pit, dark below a rim of trodden earth.
  g.poly(flat([at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)]))
    .fill(palette.dirt)
    .stroke(INK);
  const i = 0.12;
  g.poly(flat([at(x0 + i, y0 + i), at(x1 - i, y0 + i), at(x1 - i, y1 - i), at(x0 + i, y1 - i)]))
    .fill(palette.ditch)
    .stroke(THIN_INK);
  // The log's line down the middle of the pit, and a trestle near each end.
  const mid = long === 'x' ? (y0 + y1) / 2 : (x0 + x1) / 2;
  const from = long === 'x' ? x0 + 0.1 : y0 + 0.1;
  const to = long === 'x' ? x1 - 0.1 : y1 - 0.1;
  const point = (u: number, z: number) => (long === 'x' ? at(u, mid, z) : at(mid, u, z));
  const across = (u: number, side: number, z: number) =>
    long === 'x' ? at(u, mid + side * 0.28, z) : at(mid + side * 0.28, u, z);
  const logZ = WALL_H * 0.45;
  for (const u of [from + 0.25, to - 0.25]) {
    stick(g, across(u, -1, 0), point(u, logZ), 2.5 * S, palette.log);
    stick(g, across(u, 1, 0), point(u, logZ), 2.5 * S, palette.log);
  }
  stick(g, point(from, logZ), point(to, logZ), 9 * S, palette.log);
  const end = point(to, logZ);
  g.circle(end.x, end.y, 6 * S)
    .fill(palette.logEnd)
    .stroke(THIN_INK);
  // The frame saw standing in its cut, a third of the way along.
  const cut = from + (to - from) * 0.4;
  const foot = point(cut, logZ - 22 * S);
  const head = point(cut, logZ + 26 * S);
  g.poly([
    foot.x - 2 * S,
    foot.y,
    foot.x + 2 * S,
    foot.y,
    head.x + 2 * S,
    head.y,
    head.x - 2 * S,
    head.y,
  ])
    .fill(palette.axeHead)
    .stroke(THIN_INK);
  stick(
    g,
    { x: head.x - 7 * S, y: head.y },
    { x: head.x + 7 * S, y: head.y },
    2.5 * S,
    palette.log,
  );
  // Sawdust heaped at the near corner.
  const dust = at(x1, y1);
  g.ellipse(dust.x - 10 * S, dust.y - 3 * S, 10 * S, 4 * S)
    .fill(palette.sawdust)
    .stroke(THIN_INK);
}

/**
 * The stonecutter: a board shed under shingles, and before it a squared block on a bench with a
 * mallet and chisel, on the front wall away from the door.
 */
function drawStonecutter(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, HUT_PAD, 0.36);
  const eave = HUT_EAVE * 0.85;
  const roof = gable(box, hutAxis(face), eave, ROOF_H * 0.7, 0.1);
  drawGableBack(g, roof, SHINGLES);
  drawWall(g, box, 'south', roof.south, PLANKS);
  drawWall(g, box, 'east', roof.east, PLANKS);
  drawDoor(g, layout, box, 0, WALL_H * 0.7);
  drawGableFront(g, roof, SHINGLES);
  // The bench: a plank on two legs, and the block on it.
  const benchZ = WALL_H * 0.32;
  for (const u of [0.25, 0.75]) {
    stick(
      g,
      wallPoint(box, wall, u, 0.2, 0),
      wallPoint(box, wall, u, 0.2, benchZ),
      2.5 * S,
      palette.log,
    );
  }
  stick(
    g,
    wallPoint(box, wall, 0.15, 0.2, benchZ),
    wallPoint(box, wall, 0.85, 0.2, benchZ),
    5 * S,
    palette.plank,
  );
  const c = wallPoint(box, wall, 0.5, 0.2, benchZ + 2 * S);
  const w = 9 * S;
  const h = 9 * S;
  g.poly([c.x - w, c.y, c.x + w, c.y, c.x + w, c.y - h, c.x - w, c.y - h])
    .fill(palette.cutStoneDark)
    .stroke(THIN_INK);
  g.poly([
    c.x - w,
    c.y - h,
    c.x - w + 5 * S,
    c.y - h - 4 * S,
    c.x + w + 5 * S,
    c.y - h - 4 * S,
    c.x + w,
    c.y - h,
  ])
    .fill(palette.cutStone)
    .stroke(THIN_INK);
  // A chisel standing on the block.
  stick(
    g,
    { x: c.x + 3 * S, y: c.y - h - 2 * S },
    { x: c.x + 6 * S, y: c.y - h - 14 * S },
    1.5 * S,
    palette.axeHead,
  );
}

/**
 * The brick kiln: a squat brick oven, its courses showing, a dark firing mouth on the door's
 * wall and smoke from a stone chimney on top.
 */
function drawBrickKiln(g: Graphics, layout: BuildingLayout): void {
  const box = bodyBox(layout, 0.14);
  const h = WALL_H * 0.85;
  const brick: Timber = { light: palette.brick, dark: palette.brickDark, grain: 'logs' };
  const top = flatTop(h);
  drawWall(g, box, 'south', top, brick);
  drawWall(g, box, 'east', top, brick);
  g.poly(
    flat([
      at(box.x0, box.y0, h),
      at(box.x1, box.y0, h),
      at(box.x1, box.y1, h),
      at(box.x0, box.y1, h),
    ]),
  )
    .fill(palette.brickDark)
    .stroke(INK);
  // The firing mouth, an arch on the door's wall when it faces the camera.
  const face = doorFace(layout);
  if (!isBackFace(face)) {
    const wall = face as FrontWall;
    const u = doorAlong(layout, box, wall) ?? 0.5;
    const m = wallPoint(box, wall, u, 0, 0);
    g.moveTo(m.x - 8 * S, m.y)
      .lineTo(m.x - 8 * S, m.y - 10 * S)
      .arc(m.x, m.y - 10 * S, 8 * S, Math.PI, 0)
      .lineTo(m.x + 8 * S, m.y)
      .closePath()
      .fill(palette.door)
      .stroke(INK);
    g.ellipse(m.x, m.y - 4 * S, 4 * S, 2 * S).fill({ color: palette.windowLit, alpha: 0.8 });
  }
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  drawChimney(g, cx, cy, h, h + ROOF_H * 0.8);
  drawSmoke(g, at(cx, cy, h + ROOF_H * 0.8));
}

/**
 * The smokehouse: a small, tall log house under bark, smoke seeping from its gable, and a rack of
 * fish smoking before the front wall away from the door.
 */
function drawSmokehouse(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, HUT_PAD, 0.36);
  const eave = HUT_EAVE;
  const rise = ROOF_H * 0.85;
  const roof = gable(box, hutAxis(face), eave, rise, 0.1);
  drawGableBack(g, roof, BARK);
  drawWall(g, box, 'south', roof.south, LOGS);
  drawWall(g, box, 'east', roof.east, LOGS);
  drawCorners(g, box, flatTop(eave), flatTop(eave));
  drawDoor(g, layout, box, 0, WALL_H * 0.7);
  drawGableFront(g, roof, BARK);
  drawSmoke(g, at((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, eave + rise));
  // The rack: two posts, a pole, and fish hung from it.
  const barZ = WALL_H * 0.75;
  for (const u of [0.12, 0.88]) {
    stick(
      g,
      wallPoint(box, wall, u, 0.22, 0),
      wallPoint(box, wall, u, 0.22, barZ + 3 * S),
      2.5 * S,
      palette.log,
    );
  }
  stick(
    g,
    wallPoint(box, wall, 0.1, 0.22, barZ),
    wallPoint(box, wall, 0.9, 0.22, barZ),
    2.5 * S,
    palette.log,
  );
  for (const u of [0.3, 0.5, 0.7]) {
    const p = wallPoint(box, wall, u, 0.22, barZ);
    g.moveTo(p.x, p.y)
      .lineTo(p.x, p.y + 3 * S)
      .stroke({ width: 1 * S, color: palette.rope });
    g.ellipse(p.x, p.y + 10 * S, 3 * S, 7 * S)
      .fill(palette.smoked)
      .stroke(THIN_INK);
    g.poly([p.x - 3 * S, p.y + 20 * S, p.x, p.y + 16 * S, p.x + 3 * S, p.y + 20 * S]).fill(
      palette.smoked,
    );
  }
}

// ---------------------------------------------------------------- Tier-2 workshops

/**
 * The bloomery: a squat stone shaft furnace narrowing to its top, a glowing mouth toward the door,
 * embers in its throat and smoke rising from it.
 */
function drawBloomery(g: Graphics, layout: BuildingLayout): void {
  const { origin, size } = layout;
  const c = at(origin.x + size.w / 2, origin.y + size.h / 2, 0);
  const rx = TILE_H * 0.5;
  const ry = rx / 2;
  const h = WALL_H * 1.4;
  const tx = rx * 0.5;
  const top = { x: c.x, y: c.y - h };
  // The shaft: a cone cut off at the top, its front curve along the ground.
  g.moveTo(c.x - rx, c.y)
    .lineTo(top.x - tx, top.y)
    .lineTo(top.x + tx, top.y)
    .lineTo(c.x + rx, c.y)
    .arc(c.x, c.y, rx, 0, Math.PI)
    .closePath()
    .fill(palette.stone)
    .stroke(INK);
  // Shade on the camera's right, and a few courses of stone.
  g.poly([
    top.x + tx * 0.3,
    top.y,
    top.x + tx,
    top.y,
    c.x + rx,
    c.y,
    c.x + rx * 0.35,
    c.y + ry,
  ]).fill({ color: palette.stoneDark, alpha: 0.6 });
  for (const f of [0.3, 0.6]) {
    const w = rx + (tx - rx) * f;
    g.moveTo(c.x - w, c.y - h * f)
      .quadraticCurveTo(c.x, c.y - h * f + ry * 1.2, c.x + w, c.y - h * f)
      .stroke({ ...THIN_INK, alpha: 0.6 });
  }
  // The throat with its embers.
  g.ellipse(top.x, top.y, tx, tx / 2)
    .fill(palette.charcoal)
    .stroke(THIN_INK);
  g.ellipse(top.x, top.y, tx * 0.5, tx * 0.22).fill({ color: palette.windowLit, alpha: 0.75 });
  drawSmoke(g, top);
  // The mouth, on the door's side of the shaft, glowing.
  const { sill } = doorway(layout);
  const m = lerp(c, at(sill.x, sill.y, 0), 0.7);
  g.moveTo(m.x - 6 * S, m.y)
    .lineTo(m.x - 6 * S, m.y - 8 * S)
    .arc(m.x, m.y - 8 * S, 6 * S, Math.PI, 0)
    .lineTo(m.x + 6 * S, m.y)
    .closePath()
    .fill(palette.door)
    .stroke(INK);
  g.ellipse(m.x, m.y - 3 * S, 3.5 * S, 2 * S).fill({ color: palette.windowLit, alpha: 0.8 });
}

/**
 * The brewery: a board brewhouse under shingles along its length, a chimney over the copper and
 * barrels stacked before the front wall away from the door.
 */
function drawBrewery(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, HUT_PAD, 0.36);
  const axis = layout.size.w >= layout.size.h ? 'x' : 'y';
  const eave = HUT_EAVE;
  const rise = ROOF_H * 0.9;
  const roof = gable(box, axis, eave, rise, 0.1);
  drawGableBack(g, roof, SHINGLES);
  drawWall(g, box, 'south', roof.south, PLANKS);
  drawWall(g, box, 'east', roof.east, PLANKS);
  drawDoor(g, layout, box, 0, WALL_H * 0.75);
  drawGableFront(g, roof, SHINGLES);
  const cx = axis === 'x' ? box.x0 + (box.x1 - box.x0) * 0.3 : (box.x0 + box.x1) / 2;
  const cy = axis === 'y' ? box.y0 + (box.y1 - box.y0) * 0.3 : (box.y0 + box.y1) / 2;
  drawChimney(g, cx, cy, eave + rise * 0.6, eave + rise * 1.3);
  drawSmoke(g, at(cx, cy, eave + rise * 1.3));
  // Barrels: two standing, one on top between them.
  for (const [u, z] of [
    [0.3, 0],
    [0.7, 0],
    [0.5, 15 * S],
  ] as const) {
    const p = wallPoint(box, wall, u, 0.2, z);
    g.moveTo(p.x - 6 * S, p.y)
      .bezierCurveTo(p.x - 8 * S, p.y - 5 * S, p.x - 8 * S, p.y - 10 * S, p.x - 6 * S, p.y - 15 * S)
      .lineTo(p.x + 6 * S, p.y - 15 * S)
      .bezierCurveTo(p.x + 8 * S, p.y - 10 * S, p.x + 8 * S, p.y - 5 * S, p.x + 6 * S, p.y)
      .closePath()
      .fill(palette.barrel)
      .stroke(THIN_INK);
    for (const dy of [3.5, 11.5]) {
      g.moveTo(p.x - 7.2 * S, p.y - dy * S)
        .lineTo(p.x + 7.2 * S, p.y - dy * S)
        .stroke({ width: 1.5 * S, color: palette.iron });
    }
    g.ellipse(p.x, p.y - 15 * S, 6 * S, 2 * S)
      .fill(palette.barrelDark)
      .stroke(THIN_INK);
  }
}

// ---------------------------------------------------------------- Trade post

/**
 * The trade post: a board house under shingles, its ridge along the door wall, with a striped
 * awning on the props' wall over a plank counter where Merchants trade, crates stacked beside it.
 */
function drawTradePost(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const wall = propWall(face);
  const box = bodyBox(layout, HUT_PAD, 0.42);
  const axis = hutAxis(face);
  const eave = WALL_H;
  const rise = ROOF_H;
  const roof = gable(box, axis, eave, rise, 0.1);
  drawGableBack(g, roof, SHINGLES);
  drawWall(g, box, 'south', roof.south, PLANKS);
  drawWall(g, box, 'east', roof.east, PLANKS);
  drawDoor(g, layout, box, 0, WALL_H * 0.75);
  drawGableFront(g, roof, SHINGLES);
  // The counter: a plank box along the props' wall.
  const counterTop = 16 * S;
  const c = (u: number, out: number, z: number) => wallPoint(box, wall, u, out, z);
  const front = [
    c(0.15, 0.24, 0),
    c(0.85, 0.24, 0),
    c(0.85, 0.24, counterTop),
    c(0.15, 0.24, counterTop),
  ];
  const top = [
    c(0.15, 0, counterTop),
    c(0.85, 0, counterTop),
    c(0.85, 0.24, counterTop),
    c(0.15, 0.24, counterTop),
  ];
  g.poly(flat(front)).fill(palette.plankDark).stroke(INK);
  g.poly(flat(top)).fill(palette.plank).stroke(INK);
  // Goods on the counter: a sack and a small cask.
  const sack = c(0.35, 0.12, counterTop);
  g.ellipse(sack.x, sack.y - 5 * S, 6 * S, 6 * S)
    .fill(palette.paperShade)
    .stroke(THIN_INK);
  const cask = c(0.62, 0.12, counterTop);
  g.rect(cask.x - 5 * S, cask.y - 10 * S, 10 * S, 10 * S)
    .fill(palette.barrel)
    .stroke(THIN_INK);
  // The awning: from the wall under the eave, sloping out over the counter, in stripes.
  const stripes = 6;
  const hi = eave * 0.92;
  const lo = eave * 0.62;
  for (let i = 0; i < stripes; i++) {
    const u0 = 0.08 + (0.84 * i) / stripes;
    const u1 = 0.08 + (0.84 * (i + 1)) / stripes;
    const strip = [c(u0, 0, hi), c(u1, 0, hi), c(u1, 0.34, lo), c(u0, 0.34, lo)];
    g.poly(flat(strip)).fill(i % 2 === 0 ? palette.banner : palette.paper);
  }
  g.poly(flat([c(0.08, 0, hi), c(0.92, 0, hi), c(0.92, 0.34, lo), c(0.08, 0.34, lo)])).stroke(INK);
  // Two poles hold the awning's edge.
  for (const u of [0.1, 0.9]) {
    const q = c(u, 0.34, 0);
    const r = c(u, 0.34, lo);
    g.moveTo(q.x, q.y)
      .lineTo(r.x, r.y)
      .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(q.x, q.y)
      .lineTo(r.x, r.y)
      .stroke({ width: 2.5 * S, color: palette.log, cap: 'round' });
  }
  // Crates stacked by the counter's end.
  for (const [u, z] of [
    [0.04, 0],
    [0.04, 12 * S],
  ] as const) {
    const p = c(u, 0.45, z);
    g.rect(p.x - 7 * S, p.y - 12 * S, 14 * S, 12 * S)
      .fill(palette.plank)
      .stroke(THIN_INK);
    g.moveTo(p.x - 7 * S, p.y - 6 * S)
      .lineTo(p.x + 7 * S, p.y - 6 * S)
      .stroke(GRAIN);
  }
}

// ---------------------------------------------------------------- Village hall

/** Height of the village hall's stone plinth. */
const HALL_PLINTH = 14 * S;

/**
 * The village hall, the Hamlet's rank building: a long log hall on a dressed-stone plinth under a
 * tall shingle gable, its ridge along the long wall, windows either side of the door, and the
 * village's banner hung on the gable end.
 */
function drawVillageHall(g: Graphics, layout: BuildingLayout): void {
  const box = bodyBox(layout, 0.1);
  const axis = layout.size.w >= layout.size.h ? 'x' : 'y';
  const eave = wallHeight(layout.size);
  const rise = ROOF_H * 1.4;
  const roof = gable(box, axis, eave, rise, 0.12);
  drawGableBack(g, roof, SHINGLES);
  drawPlinth(g, box, HALL_PLINTH);
  drawWall(g, box, 'south', roof.south, LOGS, HALL_PLINTH);
  drawWall(g, box, 'east', roof.east, LOGS, HALL_PLINTH);
  drawCorners(g, box, flatTop(eave), flatTop(eave), HALL_PLINTH);
  const long: FrontWall = axis === 'x' ? 'south' : 'east';
  const end: FrontWall = axis === 'x' ? 'east' : 'south';
  for (const u of [0.2, 0.8]) drawHallWindow(g, box, long, u, eave);
  drawDoor(g, layout, box, 0, HALL_PLINTH + WALL_H * 0.62);
  drawBanner(g, box, end, eave + rise * 0.4, eave * 0.42);
  drawGableFront(g, roof, SHINGLES);
}

/** Dressed stone along the foot of both front walls, `h` high, in two courses. */
function drawPlinth(g: Graphics, box: Box, h: number): void {
  for (const wall of ['south', 'east'] as const) {
    const p = (u: number, z: number) => wallPoint(box, wall, u, 0.02, z);
    const face = [p(0, 0), p(1, 0), p(1, h), p(0, h)];
    g.poly(flat(face)).fill(wall === 'south' ? palette.stone : palette.stoneDark);
    const [a, b] = wallEnds(box, wall);
    const stones = Math.max(2, Math.round((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 0.3));
    const mid = [p(0, h / 2), p(1, h / 2)] as const;
    g.moveTo(mid[0].x, mid[0].y).lineTo(mid[1].x, mid[1].y);
    for (let i = 1; i < stones; i++) {
      const u = i / stones;
      const shift = 0.5 / stones;
      const lo = [p(u, 0), p(u, h / 2)] as const;
      const hi = [p(Math.min(1, u + shift), h / 2), p(Math.min(1, u + shift), h)] as const;
      g.moveTo(lo[0].x, lo[0].y).lineTo(lo[1].x, lo[1].y);
      g.moveTo(hi[0].x, hi[0].y).lineTo(hi[1].x, hi[1].y);
    }
    g.stroke({ width: 1.2 * S, color: palette.ink, alpha: 0.45 });
    g.poly(flat(face)).stroke(INK);
  }
}

/** A tall mullioned window on a front wall at `u`, under a plank lintel, below the eave `top`. */
function drawHallWindow(g: Graphics, box: Box, wall: FrontWall, u: number, top: number): void {
  const [a, b] = wallEnds(box, wall);
  const half = 0.13 / (Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
  const sill = HALL_PLINTH + 8 * S;
  const lintel = top - 9 * S;
  const p = (du: number, z: number) => wallPoint(box, wall, u + du, 0, z);
  const pane = [p(-half, sill), p(half, sill), p(half, lintel), p(-half, lintel)];
  g.poly(flat(pane)).fill(palette.window).stroke(THIN_INK);
  const mid = (sill + lintel) / 2;
  const [s0, s1, m0, m1] = [p(0, sill), p(0, lintel), p(-half, mid), p(half, mid)];
  g.moveTo(s0.x, s0.y).lineTo(s1.x, s1.y);
  g.moveTo(m0.x, m0.y).lineTo(m1.x, m1.y);
  g.stroke({ ...THIN_INK, width: 1.5 * S });
  const beam = [
    p(-half * 1.5, lintel),
    p(half * 1.5, lintel),
    p(half * 1.5, lintel + 4 * S),
    p(-half * 1.5, lintel + 4 * S),
  ];
  g.poly(flat(beam)).fill(palette.plankDark).stroke(THIN_INK);
}

/**
 * The village's banner hung from a pole across the middle of `wall`, from `top` down to `bottom`:
 * madder-red cloth with a swallowtail and a gilt roundel.
 */
function drawBanner(g: Graphics, box: Box, wall: FrontWall, top: number, bottom: number): void {
  const p = (u: number, z: number) => wallPoint(box, wall, u, 0.04, z);
  const cloth = [
    p(0.38, top),
    p(0.62, top),
    p(0.62, bottom),
    p(0.5, bottom + 7 * S),
    p(0.38, bottom),
  ];
  g.poly(flat(cloth)).fill(wall === 'south' ? palette.banner : palette.bannerDark);
  const hem = [p(0.41, top - 3 * S), p(0.41, bottom + 2 * S)] as const;
  const hem2 = [p(0.59, top - 3 * S), p(0.59, bottom + 2 * S)] as const;
  g.moveTo(hem[0].x, hem[0].y).lineTo(hem[1].x, hem[1].y);
  g.moveTo(hem2[0].x, hem2[0].y).lineTo(hem2[1].x, hem2[1].y);
  g.stroke({ width: 1.5 * S, color: palette.gilt, alpha: 0.8 });
  g.poly(flat(cloth)).stroke(THIN_INK);
  const c = p(0.5, (top + bottom) / 2 + 2 * S);
  g.circle(c.x, c.y, 5 * S)
    .fill(palette.gilt)
    .stroke({ ...THIN_INK, width: 1.5 * S });
  const pole = [p(0.33, top + 1 * S), p(0.67, top + 1 * S)] as const;
  g.moveTo(pole[0].x, pole[0].y)
    .lineTo(pole[1].x, pole[1].y)
    .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
  g.moveTo(pole[0].x, pole[0].y)
    .lineTo(pole[1].x, pole[1].y)
    .stroke({ width: 2.5 * S, color: palette.log, cap: 'round' });
}

// ---------------------------------------------------------------- Notice board

/**
 * The notice board: a plank board between two posts across the middle of its tile, facing its
 * door, under a little shingled cap, with sheets pinned to it (only its back shows when the door
 * is on a back face).
 */
function drawNoticeBoard(g: Graphics, layout: BuildingLayout): void {
  const face = doorFace(layout);
  const { origin } = layout;
  const cx = origin.x + 0.5;
  const cy = origin.y + 0.5;
  const alongX = face === 'south' || face === 'north';
  const half = 0.36;
  // The board's line on the ground, left to right on screen, and the way out toward the camera.
  const a = alongX ? { x: cx - half, y: cy } : { x: cx, y: cy + half };
  const b = alongX ? { x: cx + half, y: cy } : { x: cx, y: cy - half };
  const n = alongX ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const p = (t: number, z: number, out = 0): Vec =>
    at(a.x + (b.x - a.x) * t + n.x * out, a.y + (b.y - a.y) * t + n.y * out, z);
  const bottom = 12 * S;
  const top = 44 * S;
  const postTop = 50 * S;
  const ridge = postTop + 8 * S;
  const posts: [Vec, Vec][] = [0.06, 0.94].map((t) => [p(t, 0), p(t, postTop)]);
  for (const [q, r] of posts) g.moveTo(q.x, q.y).lineTo(r.x, r.y);
  g.stroke({ width: 8 * S, color: palette.ink, cap: 'round' });
  for (const [q, r] of posts) g.moveTo(q.x, q.y).lineTo(r.x, r.y);
  g.stroke({ width: 4.5 * S, color: palette.log, cap: 'round' });
  // The cap's back slope, behind the board.
  g.poly(
    flat([p(-0.1, top + 2 * S, -0.2), p(1.1, top + 2 * S, -0.2), p(1.1, ridge), p(-0.1, ridge)]),
  )
    .fill(palette.roofDark)
    .stroke(INK);
  const board = [p(0, bottom), p(1, bottom), p(1, top), p(0, top)];
  g.poly(flat(board)).fill(alongX ? palette.plank : palette.plankDark);
  for (const z of [bottom + (top - bottom) / 3, bottom + (2 * (top - bottom)) / 3]) {
    const q = p(0, z);
    const r = p(1, z);
    g.moveTo(q.x, q.y).lineTo(r.x, r.y);
  }
  g.stroke(GRAIN);
  g.poly(flat(board)).stroke(INK);
  if (!isBackFace(face)) {
    for (const [t0, t1, z0, z1] of [
      [0.12, 0.4, 17, 38],
      [0.47, 0.7, 23, 40],
      [0.75, 0.9, 16, 31],
    ] as const) {
      const sheet = [
        p(t0, z0 * S, 0.01),
        p(t1, z0 * S, 0.01),
        p(t1, z1 * S, 0.01),
        p(t0, z1 * S, 0.01),
      ];
      g.poly(flat(sheet)).fill(palette.paper).stroke(THIN_INK);
      for (let z = z1 - 6; z > z0 + 3; z -= 4) {
        const q = p(t0 + 0.03, z * S, 0.01);
        const r = p(t1 - 0.03, z * S, 0.01);
        g.moveTo(q.x, q.y).lineTo(r.x, r.y);
      }
      g.stroke({ width: 1.2 * S, color: palette.paperShade });
      const pin = p((t0 + t1) / 2, (z1 - 2) * S, 0.01);
      g.circle(pin.x, pin.y, 1.5 * S).fill(palette.iron);
    }
  }
  // The cap's front slope, over the board.
  drawSlope(
    g,
    [p(-0.1, top + 2 * S, 0.2), p(1.1, top + 2 * S, 0.2), p(1.1, ridge), p(-0.1, ridge)],
    palette.roof,
    SHINGLES,
  );
}
