import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { DAWN_TICKS, DUSK_TICKS, EVENING_TICKS, nightLook } from '../src/render/night';
import { palette } from '../src/render/palette';

// Spring Dusk is 2400 ticks after Dawn; a day is 3600. Winter (day 16 on) Dusk is at 1800.
const DUSK = 2400;
const DAWN = 3600;
const WINTER_DAWN = 15 * 3600;
const DAYLIGHT = 0xffffff;

describe('night look', () => {
  it('is plain daylight until the evening', () => {
    expect(nightLook(0, content)).toEqual({ tint: DAYLIGHT, glow: 0 });
    expect(nightLook(DUSK - EVENING_TICKS, content)).toEqual({ tint: DAYLIGHT, glow: 0 });
  });

  it('warms to the dusk colour by Dusk, before any light glows', () => {
    expect(nightLook(DUSK, content)).toEqual({ tint: palette.dusk, glow: 0 });
  });

  it('deepens to full night after Dusk, lights glowing brighter as it does', () => {
    expect(nightLook(DUSK + DUSK_TICKS / 2, content).glow).toBeCloseTo(0.5);
    expect(nightLook(DUSK + DUSK_TICKS, content)).toEqual({ tint: palette.night, glow: 1 });
    expect(nightLook(3000, content)).toEqual({ tint: palette.night, glow: 1 });
  });

  it('lifts back to daylight by Dawn', () => {
    expect(nightLook(DAWN - DAWN_TICKS, content)).toEqual({ tint: palette.night, glow: 1 });
    const late = nightLook(DAWN - DAWN_TICKS / 2, content);
    expect(late.glow).toBeGreaterThan(0);
    expect(late.glow).toBeLessThan(1);
    expect(nightLook(DAWN, content)).toEqual({ tint: DAYLIGHT, glow: 0 });
  });

  it('falls earlier in winter', () => {
    expect(nightLook(WINTER_DAWN + 1800, content).tint).toBe(palette.dusk);
    expect(nightLook(WINTER_DAWN + 1800 + DUSK_TICKS, content).glow).toBe(1);
    expect(nightLook(1800, content)).toEqual({ tint: DAYLIGHT, glow: 0 });
  });
});
