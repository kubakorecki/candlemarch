import { describe, expect, it } from 'vitest';
import { FOG_DARK, FOG_DIM, fogField } from '../src/render/fogField';

/**
 * A Fog map from rows of `#` (unrevealed), `.` (Revealed, not In sight) and `o` (In sight), packed
 * into tile bits the way the sim keeps them.
 */
function fog(rows: string[]) {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  const revealed: number[] = new Array(Math.ceil((width * height) / 32)).fill(0);
  const inSight: number[] = new Array(Math.ceil((width * height) / 32)).fill(0);
  const set = (bits: number[], i: number) => {
    bits[i >> 5] = (bits[i >> 5] ?? 0) | (1 << (i & 31));
  };
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const i = y * width + x;
      if (c !== '#') set(revealed, i);
      if (c === 'o') set(inSight, i);
    });
  });
  return { width, height, revealed, inSight };
}

/** The darkness drawn over tile (x, y): the field has a one-pixel border round the map. */
function at(field: Uint8ClampedArray, width: number, x: number, y: number): number {
  return field[(y + 1) * (width + 2) + x + 1] ?? -1;
}

describe('fog field', () => {
  it('leaves tiles In sight clear, dims Revealed ones and blacks out the rest', () => {
    const map = fog(['ooo....####', 'ooo....####', 'ooo....####', 'ooo....####']);
    const field = fogField(map);
    expect(field.length).toBe((11 + 2) * (4 + 2));
    expect(at(field, 11, 0, 1)).toBe(0);
    expect(at(field, 11, 4, 1)).toBe(FOG_DIM);
    expect(at(field, 11, 10, 1)).toBe(FOG_DARK);
    expect(FOG_DARK).toBe(255);
    expect(FOG_DIM).toBeGreaterThan(0);
    expect(FOG_DIM).toBeLessThan(FOG_DARK);
  });

  it('softens each edge on the side the player sees, never lightening a darker tile', () => {
    const map = fog(['oooo####', 'oooo####', 'oooo####']);
    const field = fogField(map);
    // The last tile In sight before the edge has a third of its neighbourhood black.
    expect(at(field, 8, 3, 1)).toBe(85);
    expect(at(field, 8, 2, 1)).toBe(0);
    // Unrevealed tiles stay black right up to the edge.
    expect(at(field, 8, 4, 1)).toBe(FOG_DARK);
  });

  it('carries the edge tiles out into the border, so the map edge is covered like its tiles', () => {
    const map = fog(['#oo', '#oo', '#oo']);
    const field = fogField(map);
    const width = 3 + 2;
    expect(field[0 * width + 0]).toBe(FOG_DARK); // corner, next to (0, 0)
    expect(field[2 * width + 0]).toBe(FOG_DARK); // left of (0, 1)
    expect(field[2 * width + 4]).toBe(at(field, 3, 2, 1)); // right of (2, 1)
  });
});
