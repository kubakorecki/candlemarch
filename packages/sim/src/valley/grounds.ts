// Cutting the Valley's Forest into Hunting grounds (spec, World and map: "Forest ecology").
import { neighbourTable } from './layout';

/**
 * Each 4-connected stretch of `tiles` (tile indices on an `n`×`n` map), split in halves across
 * its longer side until no piece has more than `maxTiles`; pieces under `minTiles` are left out.
 * Pieces come back with ascending tiles, ordered by their first tile.
 */
export function forestStretches(
  n: number,
  tiles: readonly number[],
  maxTiles: number,
  minTiles: number,
): number[][] {
  const pieces: number[][] = [];
  const cut = (stretch: number[]) => {
    if (stretch.length <= maxTiles) {
      if (stretch.length >= minTiles) pieces.push(stretch);
      return;
    }
    let [left, right, top, bottom] = [n, 0, n, 0];
    for (const i of stretch) {
      left = Math.min(left, i % n);
      right = Math.max(right, i % n);
      top = Math.min(top, Math.floor(i / n));
      bottom = Math.max(bottom, Math.floor(i / n));
    }
    const wide = right - left >= bottom - top;
    // Row-major order already sorts by row; across a wide stretch sort by column first.
    const sorted = wide ? [...stretch].sort((a, b) => (a % n) - (b % n) || a - b) : stretch;
    const half = Math.floor(sorted.length / 2);
    for (const part of [sorted.slice(0, half), sorted.slice(half)]) {
      for (const piece of stretchesOf(n, part)) cut(piece);
    }
  };
  for (const stretch of stretchesOf(n, tiles)) cut(stretch);
  return pieces.sort((a, b) => (a[0] as number) - (b[0] as number));
}

/** The 4-connected stretches of `tiles`, each with ascending tiles, by first tile. */
function stretchesOf(n: number, tiles: readonly number[]): number[][] {
  const table = neighbourTable(n);
  const left = new Uint8Array(n * n);
  for (const i of tiles) left[i] = 1;
  const result: number[][] = [];
  for (const first of [...tiles].sort((a, b) => a - b)) {
    if (!left[first]) continue;
    left[first] = 0;
    const stretch = [first];
    for (let k = 0; k < stretch.length; k++) {
      const i = stretch[k] as number;
      for (let e = i * 4; e < i * 4 + 4; e++) {
        const j = table[e] as number;
        if (j < 0 || !left[j]) continue;
        left[j] = 0;
        stretch.push(j);
      }
    }
    result.push(stretch.sort((a, b) => a - b));
  }
  return result;
}
