// Placeholder art drawn in code: bold ink outlines, flat earthy fills. Colours come from palette.ts.
import type { ResourceAmount, ResourceId, TerrainId } from '@candlemarch/content';
import type { BuildingLayout } from '@candlemarch/sim';
import type { Graphics } from 'pixi.js';
import { gridToWorld, TILE_H, TILE_W, type Vec } from './iso';
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

/**
 * The whole map: checkered grass tiles, faint grid lines, an earthen front edge, and river tiles
 * as flat water outlined in ink where they meet land, or pale cracked ice when `frozen`.
 * `terrain` is row-major, as in the sim.
 */
export function drawGround(
  g: Graphics,
  width: number,
  height: number,
  terrain: readonly TerrainId[],
  frozen: boolean,
): void {
  const onMap = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const isRiver = (x: number, y: number) => onMap(x, y) && terrain[y * width + x] === 'river';
  // Off the map is neither: the map's own edge gets its outline at the end.
  const isLand = (x: number, y: number) => onMap(x, y) && !isRiver(x, y);
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

  // Water over the grid lines, then an ink edge on every side that borders land.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isRiver(x, y)) g.poly(flat(diamond(x, y))).fill(frozen ? palette.ice : palette.river);
    }
  }
  if (frozen) {
    // A crack across each ice tile, bent differently tile to tile so the sheet doesn't look tiled.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isRiver(x, y)) continue;
        const bend = ((x * 7 + y * 3) % 5) / 10 + 0.3;
        const a = gridToWorld(x + 0.2, y + bend);
        const b = gridToWorld(x + 0.5, y + 1 - bend);
        const c = gridToWorld(x + 0.8, y + 0.5);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y);
      }
    }
    g.stroke({ width: 1.5, color: palette.iceCrack, alpha: 0.8 });
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isRiver(x, y)) continue;
      const [top, right, bottom, left] = diamond(x, y);
      const sides: [boolean, Vec, Vec][] = [
        [isLand(x, y - 1), top, right],
        [isLand(x + 1, y), right, bottom],
        [isLand(x, y + 1), bottom, left],
        [isLand(x - 1, y), left, top],
      ];
      for (const [shore, a, b] of sides) if (shore) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
  }
  g.stroke(INK);
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

/** A berry bush, drawn like `drawTree`: berries while it has some, bare and dry once withered. */
export function drawBerryBush(g: Graphics, amount: number, withered: boolean): void {
  g.clear();
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
  g.clear();
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
function isBackFace(face: DoorFace): boolean {
  return face === 'north' || face === 'west';
}

/**
 * Grid offset from the door tile's centre to the goods pile beside it: one tile along the wall,
 * turning with the door. A south door has its pile to the west.
 */
const PILE_BESIDE: Record<DoorFace, Vec> = {
  south: { x: -0.8, y: 0.1 },
  west: { x: -0.1, y: -0.8 },
  north: { x: 0.8, y: -0.1 },
  east: { x: 0.1, y: 0.8 },
};

/** Door rectangle on the front-left (south) or front-right (east) wall. */
function drawDoor(g: Graphics, layout: BuildingLayout, face: DoorFace): void {
  const { origin, size, door } = layout;
  let a: Vec;
  let b: Vec;
  if (face === 'south') {
    a = gridToWorld(door.x + 0.25, origin.y + size.h);
    b = gridToWorld(door.x + 0.75, origin.y + size.h);
  } else if (face === 'east') {
    a = gridToWorld(origin.x + size.w, door.y + 0.75);
    b = gridToWorld(origin.x + size.w, door.y + 0.25);
  } else {
    return;
  }
  const doorH = WALL_H * 0.7;
  g.poly(flat([a, b, up(b, doorH), up(a, doorH)]))
    .fill(palette.door)
    .stroke(THIN_INK);
}

/**
 * A doorstep on the ground at `door`: where a door on a hidden back wall opens, and where a site's
 * door will be. Its long side runs along the wall.
 */
function drawDoorstep(g: Graphics, door: Vec, face: DoorFace): void {
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

/** Wall height of a building `size` tiles across: bigger buildings stand a little taller. */
function wallHeight(size: { w: number; h: number }): number {
  return WALL_H * (0.8 + 0.2 * Math.max(size.w, size.h));
}

/**
 * World corners of a House's window: mid-wall on the front-right (east) wall, or on the front-left
 * (south) wall when the door is on the east one.
 */
export function houseWindow(layout: BuildingLayout): [Vec, Vec, Vec, Vec] {
  const { origin, size } = layout;
  const wallH = wallHeight(size);
  const half = 0.16;
  let a: Vec;
  let b: Vec;
  if (doorFace(layout) === 'east') {
    const mid = origin.x + size.w / 2;
    a = gridToWorld(mid - half, origin.y + size.h);
    b = gridToWorld(mid + half, origin.y + size.h);
  } else {
    const mid = origin.y + size.h / 2;
    a = gridToWorld(origin.x + size.w, mid + half);
    b = gridToWorld(origin.x + size.w, mid - half);
  }
  const sill = wallH * 0.3;
  const lintel = wallH * 0.68;
  return [up(a, sill), up(b, sill), up(b, lintel), up(a, lintel)];
}

/**
 * A finished building in world coordinates: an iso box with a pyramid roof and a door on the wall
 * it faces, or a doorstep on the ground when that wall is at the back. `stock` draws a pile beside
 * the door (the output buffer); `window` adds a House's window (`houseWindow`), unlit.
 */
export function drawBuilding(
  g: Graphics,
  layout: BuildingLayout,
  stock: ResourceAmount | null,
  window = false,
): void {
  g.clear();
  const { origin, size } = layout;
  const face = doorFace(layout);
  const back = isBackFace(face);
  const drawPile = () => {
    if (!stock || stock.amount <= 0) return;
    const beside = PILE_BESIDE[face];
    const at = gridToWorld(layout.door.x + 0.5 + beside.x, layout.door.y + 0.5 + beside.y);
    drawGoodsPile(g, stock.resource, at.x, at.y, stock.amount);
  };
  // A pile behind the building goes first so the walls hide what they should.
  if (back) drawPile();

  const [top, right, bottom, left] = diamond(origin.x, origin.y, size.w, size.h);
  const centre = lerp(top, bottom, 0.5);
  const span = Math.max(size.w, size.h);
  const wallH = wallHeight(size);
  const roofH = ROOF_H * (0.7 + 0.3 * span);
  const apex = up(centre, wallH + roofH);

  g.poly(flat([top, right, bottom, left])).fill({ color: palette.shadow, alpha: 0.3 });
  g.poly(flat([left, bottom, up(bottom, wallH), up(left, wallH)]))
    .fill(palette.wallLight)
    .stroke(INK);
  g.poly(flat([bottom, right, up(right, wallH), up(bottom, wallH)]))
    .fill(palette.wallDark)
    .stroke(INK);
  drawDoor(g, layout, face);
  if (window) {
    g.poly(flat(houseWindow(layout)))
      .fill(palette.window)
      .stroke(THIN_INK);
  }

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

  if (back) drawBackDoorMark(g, layout.door, face);
  else drawPile();
}

/**
 * A door on a hidden back wall: its doorstep and a small door standing on the door tile, drawn
 * over the building so it stays readable.
 */
function drawBackDoorMark(g: Graphics, door: Vec, face: DoorFace): void {
  drawDoorstep(g, door, face);
  const s = TILE_H / 64;
  const c = gridToWorld(door.x + 0.5, door.y + 0.5);
  const w = 7 * s;
  const h = 22 * s;
  g.roundRect(c.x - w, c.y - h, w * 2, h, w)
    .fill(palette.door)
    .stroke(THIN_INK);
  g.rect(c.x - w, c.y - h / 2, w * 2, h / 2).fill(palette.door);
  g.moveTo(c.x - w, c.y - h / 2)
    .lineTo(c.x - w, c.y)
    .lineTo(c.x + w, c.y)
    .lineTo(c.x + w, c.y - h / 2)
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
  PIECES[resource].draw(g, 0, -52 * s, s);
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
