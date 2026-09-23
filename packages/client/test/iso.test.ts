import { describe, expect, it } from 'vitest';
import {
  gridToWorld,
  screenToTile,
  TILE_H,
  TILE_W,
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
});
