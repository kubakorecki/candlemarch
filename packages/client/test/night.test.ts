import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { NIGHT_FADE_TICKS, nightDarkness } from '../src/render/night';

// Spring Dusk is 2400 ticks after Dawn; a day is 3600. Winter (day 16 on) Dusk is at 1800.
const WINTER_DAWN = 15 * 3600;

describe('night darkness', () => {
  it('is clear by day', () => {
    expect(nightDarkness(0, content)).toBe(0);
    expect(nightDarkness(2399, content)).toBe(0);
  });

  it('fades in after Dusk and out before Dawn', () => {
    expect(nightDarkness(2400, content)).toBe(0);
    expect(nightDarkness(2400 + NIGHT_FADE_TICKS / 2, content)).toBeCloseTo(0.5);
    expect(nightDarkness(2400 + NIGHT_FADE_TICKS, content)).toBe(1);
    expect(nightDarkness(3000, content)).toBe(1);
    expect(nightDarkness(3600 - NIGHT_FADE_TICKS / 2, content)).toBeCloseTo(0.5);
    expect(nightDarkness(3600, content)).toBe(0);
  });

  it('falls earlier in winter', () => {
    expect(nightDarkness(WINTER_DAWN + 1800 + NIGHT_FADE_TICKS, content)).toBe(1);
    expect(nightDarkness(1800 + NIGHT_FADE_TICKS, content)).toBe(0);
  });
});
