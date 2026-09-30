// Value noise for the Valley generator, from the seeded PRNG only.
import { nextU32, type RngHolder } from '../rng';

/** A smooth field over the map: a value in [0, 1) per tile. */
export type Noise = (x: number, y: number) => number;

/**
 * Value noise over a `size`×`size` map: a random value at every `cell` tiles, blended smoothly
 * in between. Draws its lattice from `rng` at once, row by row, so the same PRNG state always
 * gives the same field. Only +, −, × and ÷, so every engine computes the same numbers.
 */
export function valueNoise(rng: RngHolder, size: number, cell: number): Noise {
  const side = Math.floor(size / cell) + 2;
  const lattice = new Float64Array(side * side);
  for (let i = 0; i < lattice.length; i++) lattice[i] = nextU32(rng) / 4294967296;
  const at = (gx: number, gy: number) => lattice[gy * side + gx] as number;
  return (x, y) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const fx = (x - gx * cell) / cell;
    const fy = (y - gy * cell) / cell;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(gx, gy) * (1 - sx) + at(gx + 1, gy) * sx;
    const bottom = at(gx, gy + 1) * (1 - sx) + at(gx + 1, gy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}
