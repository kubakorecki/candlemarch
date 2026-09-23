// All isometric maths: grid (tiles) ↔ world (pixels at zoom 1) ↔ screen (canvas pixels).
// Grid point (gx, gy) is a position in tiles; tile (x, y) covers [x, x+1) × [y, y+1).
import { type Point, TILE_UNITS } from '@candlemarch/sim';

/** Size of one tile's diamond at zoom 1. Isometric tiles are 2:1. */
export const TILE_W = 128;
export const TILE_H = TILE_W / 2;

export interface Vec {
  x: number;
  y: number;
}

/** Camera: `zoom`, and the world point shown at the centre of the screen. */
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export function gridToWorld(gx: number, gy: number): Vec {
  return { x: ((gx - gy) * TILE_W) / 2, y: ((gx + gy) * TILE_H) / 2 };
}

export function worldToGrid(wx: number, wy: number): Vec {
  const a = wx / (TILE_W / 2);
  const b = wy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Sim position (sub-tile units) to grid coordinates. */
export function unitsToGrid(p: Point): Vec {
  return { x: p.x / TILE_UNITS, y: p.y / TILE_UNITS };
}

export function unitsToWorld(p: Point): Vec {
  const g = unitsToGrid(p);
  return gridToWorld(g.x, g.y);
}

/** World point at the centre of tile (x, y), on the ground. */
export function tileCenterWorld(x: number, y: number): Vec {
  return gridToWorld(x + 0.5, y + 0.5);
}

/** Where the world origin sits on screen for this camera. */
export function worldOriginOnScreen(camera: CameraView, screenW: number, screenH: number): Vec {
  return { x: screenW / 2 - camera.x * camera.zoom, y: screenH / 2 - camera.y * camera.zoom };
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: CameraView,
  screenW: number,
  screenH: number,
): Vec {
  const o = worldOriginOnScreen(camera, screenW, screenH);
  return { x: (sx - o.x) / camera.zoom, y: (sy - o.y) / camera.zoom };
}

export function worldToScreen(
  wx: number,
  wy: number,
  camera: CameraView,
  screenW: number,
  screenH: number,
): Vec {
  const o = worldOriginOnScreen(camera, screenW, screenH);
  return { x: o.x + wx * camera.zoom, y: o.y + wy * camera.zoom };
}

/** Tile under a screen point. */
export function screenToTile(
  sx: number,
  sy: number,
  camera: CameraView,
  screenW: number,
  screenH: number,
): Vec {
  const w = screenToWorld(sx, sy, camera, screenW, screenH);
  const g = worldToGrid(w.x, w.y);
  return { x: Math.floor(g.x), y: Math.floor(g.y) };
}

/** Draw order: things further "down" the screen (larger gx + gy) draw on top. */
export function depthOf(gx: number, gy: number): number {
  return gx + gy;
}
