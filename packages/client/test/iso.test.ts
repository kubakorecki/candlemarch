import { describe, expect, it } from 'vitest';
import {
  gridToWorld,
  overlaps,
  screenToTile,
  TILE_H,
  TILE_W,
  tileAreaBounds,
  viewRect,
  worldToGrid,
  worldToScreen,
} from '../src/render/iso';

describe('iso', () => {
  it('uses 2:1 tiles', () => {
    expect(TILE_W).toBe(2 * TILE_H);
    const right = gridToWorld(1, 0);
    expect(right).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
  });

  it('grid -> world -> grid round-trips', () => {
    for (const [gx, gy] of [
      [0, 0],
      [3.25, 7.5],
      [23, 1],
      [-2, 4],
    ] as const) {
      const w = gridToWorld(gx, gy);
      const g = worldToGrid(w.x, w.y);
      expect(g.x).toBeCloseTo(gx);
      expect(g.y).toBeCloseTo(gy);
    }
  });

  it('screen -> tile finds the tile whose centre was projected', () => {
    const camera = { x: 300, y: 500, zoom: 0.7 };
    for (let x = 0; x < 24; x += 5) {
      for (let y = 0; y < 24; y += 3) {
        const c = gridToWorld(x + 0.5, y + 0.5);
        const s = worldToScreen(c.x, c.y, camera, 1280, 800);
        expect(screenToTile(s.x, s.y, camera, 1280, 800)).toEqual({ x, y });
      }
    }
  });

  it('the view rect is the world area the screen shows, at any zoom', () => {
    const camera = { x: 300, y: 500, zoom: 0.5 };
    expect(viewRect(camera, 1200, 800)).toEqual({ minX: -900, minY: -300, maxX: 1500, maxY: 1300 });
    expect(viewRect({ ...camera, zoom: 2 }, 1200, 800)).toEqual({
      minX: 0,
      minY: 300,
      maxX: 600,
      maxY: 700,
    });
  });

  it("a tile area's bounds cover its diamond and the art standing up to `above` over it", () => {
    // Tile (0, 0): top corner at the origin, left and right corners half a tile down.
    expect(tileAreaBounds(0, 0, 1, 1, 100)).toEqual({
      minX: -TILE_W / 2,
      minY: -100,
      maxX: TILE_W / 2,
      maxY: TILE_H,
    });
    // A 3×2 area at (2, 1): left corner (2, 3), top (2, 1), right (5, 1), bottom (5, 3).
    expect(tileAreaBounds(2, 1, 3, 2, 0)).toEqual({
      minX: -TILE_W / 2,
      minY: 1.5 * TILE_H,
      maxX: 2 * TILE_W,
      maxY: 4 * TILE_H,
    });
  });

  it('rects overlap when they share any area or touch', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(overlaps(a, { minX: 5, minY: 5, maxX: 20, maxY: 20 })).toBe(true);
    expect(overlaps(a, { minX: 10, minY: 0, maxX: 20, maxY: 10 })).toBe(true);
    expect(overlaps(a, { minX: 11, minY: 0, maxX: 20, maxY: 10 })).toBe(false);
    expect(overlaps(a, { minX: 0, minY: -20, maxX: 10, maxY: -1 })).toBe(false);
  });
});
