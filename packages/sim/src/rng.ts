// Seeded PRNG (mulberry32). Its whole state is one uint32 kept in game state.

export interface RngHolder {
  rng: number;
}

export function seedRng(seed: number): number {
  return seed >>> 0;
}

/** Next uniformly distributed uint32. */
export function nextU32(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Integer in [0, maxExclusive). */
export function randomInt(holder: RngHolder, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`randomInt: maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  return nextU32(holder) % maxExclusive;
}
