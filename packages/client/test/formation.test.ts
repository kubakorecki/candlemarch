import { describe, expect, it } from 'vitest';
import { easeOffset, formationOffsets, type Offset } from '../src/render/formation';
import { gridToWorld } from '../src/render/iso';

/** `n` walkers standing on tile (10, 7), IDs from 3. */
function crowd(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: 3 + i, tile: { x: 10, y: 7 } }));
}

function offsetOf(offsets: Record<number, Offset>, id: number): Offset {
  return offsets[id] ?? { x: 0, y: 0 };
}

describe('walkers standing on one tile', () => {
  it('leaves a walker alone on its tile where it stands', () => {
    const offsets = formationOffsets([{ id: 4, tile: { x: 10, y: 7 } }]);
    expect(offsetOf(offsets, 4)).toEqual({ x: 0, y: 0 });
  });

  it('draws two walkers on one tile side by side on screen, a figure width apart', () => {
    const offsets = formationOffsets(crowd(2));
    const a = gridToWorld(offsetOf(offsets, 3).x, offsetOf(offsets, 3).y);
    const b = gridToWorld(offsetOf(offsets, 4).x, offsetOf(offsets, 4).y);
    expect(a.y).toBeCloseTo(b.y);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(24);
  });

  it('fans out a crowd of up to eight so no two are drawn on one spot, all on their tile', () => {
    for (let n = 2; n <= 8; n++) {
      const offsets = formationOffsets(crowd(n));
      const drawn = crowd(n).map(({ id }) => offsetOf(offsets, id));
      for (const o of drawn) {
        expect(Math.abs(o.x)).toBeLessThan(0.5);
        expect(Math.abs(o.y)).toBeLessThan(0.5);
      }
      const onScreen = drawn.map((o) => gridToWorld(o.x, o.y));
      onScreen.forEach((a, i) => {
        for (const b of onScreen.slice(i + 1))
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(12);
      });
    }
  });

  it('gives each walker its slot by ID order, whatever order they come in', () => {
    const forwards = formationOffsets(crowd(5));
    const backwards = formationOffsets([...crowd(5)].reverse());
    expect(backwards).toEqual(forwards);
  });

  it('fans out only walkers that share a tile', () => {
    const offsets = formationOffsets([
      { id: 3, tile: { x: 10, y: 7 } },
      { id: 4, tile: { x: 11, y: 7 } },
      { id: 5, tile: { x: 11, y: 7 } },
    ]);
    expect(offsetOf(offsets, 3)).toEqual({ x: 0, y: 0 });
    expect(offsetOf(offsets, 4)).not.toEqual({ x: 0, y: 0 });
    expect(offsetOf(offsets, 4)).not.toEqual(offsetOf(offsets, 5));
  });
});

describe('easing into and out of a slot', () => {
  const slot = { x: 0.3, y: -0.2 };

  it('moves part of the way at once, without overshooting', () => {
    const at = easeOffset({ x: 0, y: 0 }, slot, 50);
    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(0.3);
    expect(at.y).toBeLessThan(0);
    expect(at.y).toBeGreaterThan(-0.2);
  });

  it('settles in its slot within a third of a second, however the frames fall', () => {
    let at = { x: 0, y: 0 };
    for (let t = 0; t < 300; t += 16) at = easeOffset(at, slot, 16);
    expect(at.x).toBeCloseTo(0.3, 2);
    expect(at.y).toBeCloseTo(-0.2, 2);
    expect(easeOffset({ x: 0, y: 0 }, slot, 300).x).toBeCloseTo(0.3, 2);
  });

  it('stays put when no time passes', () => {
    expect(easeOffset({ x: 0.1, y: 0 }, slot, 0)).toEqual({ x: 0.1, y: 0 });
  });
});
