// Placeholder art drawn in code: bold ink outlines, flat earthy fills. Colours come from palette.ts.
import type { BuildingDef } from '@candlemarch/content';
import type { Graphics } from 'pixi.js';
import { gridToWorld, TILE_H, type Vec } from './iso';
import { palette } from './palette';

const INK = { width: 3, color: palette.ink, join: 'round', cap: 'round' } as const;
const THIN_INK = { width: 2, color: palette.ink, join: 'round', cap: 'round' } as const;

/** Wall and roof heights scale with the tile so art keeps its proportions if TILE_W changes. */
const WALL_H = TILE_H * 0.9;
const ROOF_H = TILE_H * 0.85;
/** Depth of the map's front edge. */
const EDGE_H = TILE_H * 0.35;

function flat(points: Vec[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

function up(p: Vec, h: number): Vec {
  return { x: p.x, y: p.y - h };
}

function lerp(a: Vec, b: Vec, t: number): Vec {
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

/** The whole map: checkered grass tiles, faint grid lines, and an earthen front edge. */
export function drawGround(g: Graphics, width: number, height: number): void {
  g.clear();
  const [, right, bottom, left] = diamond(0, 0, width, height);
  // Front edges, so the map reads as a slab of land.
  g.poly(flat([left, bottom, up(bottom, -EDGE_H), up(left, -EDGE_H)]))
    .fill(palette.trunk)
    .stroke(INK);
  g.poly(flat([bottom, right, up(right, -EDGE_H), up(bottom, -EDGE_H)]))
    .fill(palette.door)
    .stroke(INK);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      g.poly(flat(diamond(x, y))).fill((x + y) % 2 === 0 ? palette.grass : palette.grassAlt);
    }
  }
  for (let i = 0; i <= width; i++) {
    const a = gridToWorld(i, 0);
    const b = gridToWorld(i, height);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  for (let j = 0; j <= height; j++) {
    const a = gridToWorld(0, j);
    const b = gridToWorld(width, j);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  g.stroke({ width: 1, color: palette.grassLine, alpha: 0.35 });
  g.poly(flat(diamond(0, 0, width, height))).stroke(INK);
}

function groundShadow(g: Graphics, rx: number, ry: number): void {
  g.ellipse(0, 0, rx, ry).fill({ color: palette.shadow, alpha: 0.35 });
}

/** A tree, drawn around (0, 0) = the centre of its tile on the ground. */
export function drawTree(g: Graphics, amount: number, fullAmount: number): void {
  g.clear();
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

/** One log lying on the ground or on a stack, centred on (x, y). */
function drawLog(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - 11 * s, y - 4 * s, 22 * s, 8 * s, 4 * s)
    .fill(palette.log)
    .stroke(THIN_INK);
  g.circle(x + 10 * s, y, 4 * s)
    .fill(palette.logEnd)
    .stroke(THIN_INK);
}

/** A pyramid of `count` logs whose bottom row is centred on (x, y). */
export function drawLogPile(g: Graphics, x: number, y: number, count: number): void {
  const s = TILE_H / 64;
  // Smallest triangle that holds them all: rows of k, k-1, ... logs.
  let bottom = 1;
  while ((bottom * (bottom + 1)) / 2 < count) bottom++;
  let placed = 0;
  for (let row = 0; placed < count; row++) {
    const inRow = bottom - row;
    for (let i = 0; i < inRow && placed < count; i++, placed++) {
      drawLog(g, x + (i - (inRow - 1) / 2) * 20 * s, y - row * 8 * s, s);
    }
  }
}

/** Door rectangle on the front-left or front-right wall, if the door tile is in front of one. */
function drawDoor(g: Graphics, def: BuildingDef, ox: number, oy: number): void {
  const { w, h } = def.size;
  let a: Vec;
  let b: Vec;
  if (def.door.y === h) {
    a = gridToWorld(ox + def.door.x + 0.25, oy + h);
    b = gridToWorld(ox + def.door.x + 0.75, oy + h);
  } else if (def.door.x === w) {
    a = gridToWorld(ox + w, oy + def.door.y + 0.75);
    b = gridToWorld(ox + w, oy + def.door.y + 0.25);
  } else {
    return;
  }
  const doorH = WALL_H * 0.7;
  g.poly(flat([a, b, up(b, doorH), up(a, doorH)]))
    .fill(palette.door)
    .stroke(THIN_INK);
}

/**
 * A finished building in world coordinates: an iso box with a pyramid roof and a door.
 * `stock` draws a log pile beside the door (the output buffer).
 */
export function drawBuilding(
  g: Graphics,
  def: BuildingDef,
  ox: number,
  oy: number,
  stock: number,
): void {
  g.clear();
  const [top, right, bottom, left] = diamond(ox, oy, def.size.w, def.size.h);
  const centre = lerp(top, bottom, 0.5);
  const wallH = WALL_H * (0.8 + 0.2 * def.size.w);
  const roofH = ROOF_H * (0.7 + 0.3 * def.size.w);
  const apex = up(centre, wallH + roofH);

  g.poly(flat([top, right, bottom, left])).fill({ color: palette.shadow, alpha: 0.3 });
  g.poly(flat([left, bottom, up(bottom, wallH), up(left, wallH)]))
    .fill(palette.wallLight)
    .stroke(INK);
  g.poly(flat([bottom, right, up(right, wallH), up(bottom, wallH)]))
    .fill(palette.wallDark)
    .stroke(INK);
  drawDoor(g, def, ox, oy);

  // Roof, with a little overhang: back faces first, then the two visible ones.
  const eave = (p: Vec) => up(lerp(centre, p, 1.12), wallH - 4);
  const [et, er, eb, el] = [eave(top), eave(right), eave(bottom), eave(left)];
  g.poly(flat([el, et, apex]))
    .fill(palette.roofDark)
    .stroke(INK);
  g.poly(flat([et, er, apex]))
    .fill(palette.roof)
    .stroke(INK);
  g.poly(flat([el, eb, apex]))
    .fill(palette.roof)
    .stroke(INK);
  g.poly(flat([eb, er, apex]))
    .fill(palette.roofDark)
    .stroke(INK);

  if (stock > 0) {
    const door = gridToWorld(ox + def.door.x + 0.5, oy + def.door.y + 0.5);
    drawLogPile(g, door.x - TILE_H * 0.9, door.y - TILE_H * 0.35, stock);
  }
}

/**
 * A construction site in world coordinates: a packed-earth plate, corner posts that rise
 * with build progress, and the logs delivered so far.
 */
export function drawSite(
  g: Graphics,
  def: BuildingDef,
  ox: number,
  oy: number,
  delivered: number,
  progress: number,
): void {
  g.clear();
  const corners = diamond(ox, oy, def.size.w, def.size.h);
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
  drawLogPile(g, centre.x, centre.y, delivered);
  // Front post last so it sits in front of the logs.
  g.moveTo(bottom.x, bottom.y).lineTo(bottom.x, bottom.y - postH);
  g.stroke({ width: 7, color: palette.ink, cap: 'round' });
  g.moveTo(bottom.x, bottom.y).lineTo(bottom.x, bottom.y - postH);
  g.stroke({ width: 3, color: palette.sitePost, cap: 'round' });
}

/** A villager, drawn around (0, 0) = their feet. */
export function drawVillager(g: Graphics, bodyColor: number): void {
  g.clear();
  const s = TILE_H / 64;
  groundShadow(g, 11 * s, 5 * s);
  g.roundRect(-8 * s, -30 * s, 16 * s, 28 * s, 7 * s)
    .fill(bodyColor)
    .stroke(INK);
  g.circle(0, -38 * s, 8 * s)
    .fill(palette.skin)
    .stroke(INK);
}

/** A log held over the head, drawn relative to the villager's feet. */
export function drawCarriedLog(g: Graphics): void {
  g.clear();
  const s = TILE_H / 64;
  drawLog(g, 0, -52 * s, s);
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
export function drawPlacementGhost(
  g: Graphics,
  def: BuildingDef,
  ox: number,
  oy: number,
  valid: boolean,
): void {
  g.clear();
  const color = valid ? palette.valid : palette.invalid;
  g.poly(flat(diamond(ox, oy, def.size.w, def.size.h)))
    .fill({ color, alpha: 0.45 })
    .stroke(INK);
  g.poly(flat(diamond(ox + def.door.x, oy + def.door.y)))
    .fill({ color, alpha: 0.15 })
    .stroke({ width: 2, color, alpha: 0.9 });
}
