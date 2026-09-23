import { describe, expect, it } from 'vitest';
import { nextU32, randomInt, seedRng } from '../src/rng';

describe('rng', () => {
  it('produces the same sequence from the same seed', () => {
    const a = { rng: seedRng(42) };
    const b = { rng: seedRng(42) };
    const seqA = Array.from({ length: 5 }, () => nextU32(a));
    const seqB = Array.from({ length: 5 }, () => nextU32(b));
    expect(seqA).toEqual(seqB);
    expect(a.rng).toBe(b.rng);
  });

  it('matches the reference mulberry32 output', () => {
    // First output of the canonical mulberry32 (bryc) for seed 1.
    expect(nextU32({ rng: seedRng(1) })).toBe(2693262067);
  });

  it('differs between seeds and keeps its state a uint32', () => {
    const a = { rng: seedRng(1) };
    const b = { rng: seedRng(2) };
    expect(nextU32(a)).not.toBe(nextU32(b));
    for (let i = 0; i < 100; i++) nextU32(a);
    expect(Number.isInteger(a.rng) && a.rng >= 0 && a.rng < 2 ** 32).toBe(true);
  });

  it('randomInt stays in range', () => {
    const h = { rng: seedRng(7) };
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(h, 6);
      expect(n >= 0 && n < 6 && Number.isInteger(n)).toBe(true);
    }
    expect(() => randomInt(h, 0)).toThrow();
  });
});
