import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dayTrack } from '../src/game/almanac';
import { DAWN_TICKS, DUSK_TICKS, EVENING_TICKS } from '../src/render/night';

// A spring day is 3600 ticks with Dusk 2400 after Dawn; winter (day 16 on) Dusk is at 1800.
const DAY = 3600;
const DUSK = 2400;
const WINTER_DAWN = 15 * DAY;

describe('day track', () => {
  it('runs from Dawn to Dawn with Dusk where the season puts it', () => {
    expect(dayTrack(0, content)).toEqual({ phase: 'day', progress: 0, duskAt: 2 / 3 });
    expect(dayTrack(DAY + 900, content).progress).toBe(0.25);
    // Steps of 18 ticks: 17 ticks in, the marker hasn't moved yet.
    expect(dayTrack(DAY + 900 + 17, content).progress).toBe(0.25);
    expect(dayTrack(DAY + 900 + 18, content).progress).toBe(0.255);
    expect(dayTrack(WINTER_DAWN, content).duskAt).toBe(0.5);
  });

  it('calls the evening before Dusk and the first of the dark Dusk', () => {
    expect(dayTrack(DUSK - EVENING_TICKS - 1, content).phase).toBe('day');
    expect(dayTrack(DUSK - EVENING_TICKS, content).phase).toBe('dusk');
    expect(dayTrack(DUSK + DUSK_TICKS - 1, content).phase).toBe('dusk');
    expect(dayTrack(DUSK + DUSK_TICKS, content).phase).toBe('night');
  });

  it('calls the end of the night, while the dark lifts, Dawn', () => {
    expect(dayTrack(DAY - DAWN_TICKS - 1, content).phase).toBe('night');
    expect(dayTrack(DAY - DAWN_TICKS, content).phase).toBe('dawn');
    expect(dayTrack(DAY, content).phase).toBe('day');
  });
});
