import { describe, expect, it } from 'vitest';
import { TREE_SPECIES, type TreeSpecies, treeLook } from '../src/render/treeLooks';

/** Every tile of a 128² Valley. */
function* valleyTiles(): Generator<[number, number]> {
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) yield [x, y];
}

describe('tree looks', () => {
  it('grows each species in woods of its own: neighbours mostly share one', () => {
    let same = 0;
    let pairs = 0;
    for (const [x, y] of valleyTiles()) {
      if (x === 127) continue;
      pairs++;
      if (treeLook(x, y).species === treeLook(x + 1, y).species) same++;
    }
    expect(same / pairs).toBeGreaterThan(0.85);
    // But not one wood the size of the Valley.
    expect(same / pairs).toBeLessThan(0.99);
  });

  it('grows every species somewhere in a Valley, each a fair share of it', () => {
    const count = new Map<TreeSpecies, number>();
    for (const [x, y] of valleyTiles()) {
      const { species } = treeLook(x, y);
      count.set(species, (count.get(species) ?? 0) + 1);
    }
    expect(TREE_SPECIES.length).toBeGreaterThanOrEqual(3);
    for (const species of TREE_SPECIES) {
      expect(count.get(species) ?? 0).toBeGreaterThan((128 * 128) / 8);
    }
  });

  it('varies the trees of one wood: size, lean, shade and shape, but keeps a tree as it is', () => {
    // A 6 × 6 patch: under half a wood across, so mostly one species.
    const looks = [];
    for (let y = 40; y < 46; y++) for (let x = 40; x < 46; x++) looks.push(treeLook(x, y));
    const sizes = new Set(looks.map((l) => l.size));
    expect(sizes.size).toBeGreaterThanOrEqual(5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1.15);
    const leans = looks.map((l) => l.lean);
    expect(leans.some((lean) => lean < 0)).toBe(true);
    expect(leans.some((lean) => lean > 0)).toBe(true);
    expect(leans.every((lean) => Math.abs(lean) <= 1)).toBe(true);
    expect(new Set(looks.map((l) => l.shade))).toEqual(new Set([0, 1, 2]));
    expect(new Set(looks.map((l) => l.shape))).toEqual(new Set([0, 1, 2, 3]));
    expect(treeLook(42, 43)).toEqual(treeLook(42, 43));
  });
});
