import type { TerrainId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { MAX_RELIEF, mountainRelief } from '../src/render/relief';
import type { GroundMap } from '../src/render/shapes';

/** A map from rows: `^` Mountain, `s` Pass snow, anything else Meadow. */
function map(rows: string[]): GroundMap {
  const terrain: TerrainId[] = [];
  for (const row of rows) {
    for (const c of row) terrain.push(c === '^' ? 'mountain' : c === 's' ? 'pass_snow' : 'meadow');
  }
  return { width: rows[0]?.length ?? 0, height: rows.length, terrain, frozen: false };
}

/** A 24-wide valley with a rim 7 tiles thick along its south edge. */
const RIM = map([
  ...Array.from({ length: 6 }, () => '.'.repeat(24)),
  ...Array.from({ length: 7 }, () => '^'.repeat(24)),
]);

/** The heights along row `y` of `m`. */
function row(heights: ArrayLike<number>, m: GroundMap, y: number): number[] {
  return Array.from({ length: m.width }, (_, x) => heights[y * m.width + x] ?? Number.NaN);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('mountain relief', () => {
  it('raises Mountain tiles only', () => {
    const heights = mountainRelief(RIM);
    for (let y = 0; y < 6; y++) expect(row(heights, RIM, y).every((h) => h === 0)).toBe(true);
    for (let y = 6; y < 13; y++) expect(row(heights, RIM, y).every((h) => h > 0)).toBe(true);
  });

  it('rises toward the rim: each row back from the valley stands higher', () => {
    const heights = mountainRelief(RIM);
    const means = [6, 7, 8, 9, 10, 11, 12].map((y) => mean(row(heights, RIM, y)));
    for (let i = 1; i < 4; i++) expect(means[i]).toBeGreaterThan((means[i - 1] ?? 0) + 0.1);
    // The foothills along the valley are all lower than the high rim behind them.
    expect(Math.max(...row(heights, RIM, 6))).toBeLessThan(Math.min(...row(heights, RIM, 11)));
  });

  it('varies tile to tile, the same each time, and never above MAX_RELIEF', () => {
    const heights = mountainRelief(RIM);
    for (let y = 6; y < 13; y++) {
      const r = row(heights, RIM, y);
      expect(new Set(r).size).toBeGreaterThan(3);
      expect(Math.max(...r)).toBeLessThanOrEqual(MAX_RELIEF);
    }
    expect(Array.from(mountainRelief(RIM))).toEqual(Array.from(heights));
  });

  it('keeps a lone ridge low, and dips where a Pass cuts through', () => {
    const ridge = map(['......', '..^^..', '..^^..', '......']);
    const low = mountainRelief(ridge);
    expect(Math.max(...Array.from(low))).toBeLessThan(
      Math.min(...row(mountainRelief(RIM), RIM, 11)),
    );
    const pass = map(['^^^^^^^^^', '^^^^s^^^^', '^^^^s^^^^', '^^^^s^^^^', '^^^^^^^^^']);
    const by = mountainRelief(pass);
    // Beside the pass the tiles are foothills; far from it they're higher.
    expect(by[2 * 9 + 3]).toBeLessThan(by[2 * 9 + 0] ?? 0);
  });
});
