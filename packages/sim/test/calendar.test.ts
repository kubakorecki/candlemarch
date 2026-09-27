import { describe, expect, it } from 'vitest';
import {
  calendarAt,
  dawnTick,
  duskTick,
  isDawn,
  isDusk,
  isNight,
  isRiverFrozen,
} from '../src/calendar';
import { content } from './helpers';

// Content numbers: a day is 3600 ticks, 5 days per season. Nights are 1200 ticks, 1800 in winter.
const DAY = 3600;
/** Dawn of day `n`, counting from 1. */
const dawnOf = (n: number) => (n - 1) * DAY;

describe('calendar', () => {
  it('a new game starts at Dawn on spring day 1 of year 1', () => {
    expect(calendarAt(0, content)).toEqual({
      day: 1,
      season: 'spring',
      dayOfSeason: 1,
      year: 1,
      timeOfDay: 0,
      isNight: false,
    });
    expect(isDawn(0, content)).toBe(true);
    expect(dawnTick(1, content)).toBe(0);
  });

  it('night begins at Dusk, two thirds into a spring day', () => {
    expect(duskTick(1, content)).toBe(2400);
    expect(isNight(2399, content)).toBe(false);
    expect(isDusk(2399, content)).toBe(false);
    expect(isNight(2400, content)).toBe(true);
    expect(isDusk(2400, content)).toBe(true);
    expect(isDusk(2401, content)).toBe(false);
    expect(calendarAt(2400, content)).toMatchObject({ day: 1, timeOfDay: 2400, isNight: true });
  });

  it('night ends at Dawn, which starts the next day', () => {
    expect(calendarAt(DAY - 1, content)).toMatchObject({ day: 1, isNight: true });
    expect(calendarAt(DAY, content)).toMatchObject({ day: 2, timeOfDay: 0, isNight: false });
    expect(isDawn(DAY, content)).toBe(true);
    expect(isDawn(DAY + 1, content)).toBe(false);
    expect(dawnTick(2, content)).toBe(DAY);
  });

  it('a winter Dusk comes earlier', () => {
    // Winter is days 16-20.
    expect(calendarAt(dawnOf(16), content)).toMatchObject({ season: 'winter', dayOfSeason: 1 });
    expect(duskTick(15, content) - dawnOf(15)).toBe(2400); // autumn
    expect(duskTick(16, content) - dawnOf(16)).toBe(1800); // winter
    expect(isNight(dawnOf(16) + 1799, content)).toBe(false);
    expect(isNight(dawnOf(16) + 1800, content)).toBe(true);
    expect(isDusk(dawnOf(16) + 1800, content)).toBe(true);
    // The autumn Dusk time is still daylight in winter's own terms, and vice versa.
    expect(isDusk(dawnOf(16) + 2400, content)).toBe(false);
    expect(isNight(dawnOf(15) + 1800, content)).toBe(false);
  });

  it('the season changes at Dawn after its fifth day', () => {
    expect(calendarAt(dawnOf(6) - 1, content)).toMatchObject({
      day: 5,
      season: 'spring',
      dayOfSeason: 5,
      isNight: true,
    });
    expect(calendarAt(dawnOf(6), content)).toMatchObject({
      day: 6,
      season: 'summer',
      dayOfSeason: 1,
      isNight: false,
    });
    expect(calendarAt(dawnOf(11), content).season).toBe('autumn');
    expect(calendarAt(dawnOf(16), content).season).toBe('winter');
  });

  it('the year changes at Dawn after the last winter day', () => {
    expect(calendarAt(dawnOf(21) - 1, content)).toMatchObject({
      day: 20,
      season: 'winter',
      dayOfSeason: 5,
      year: 1,
      isNight: true,
    });
    expect(calendarAt(dawnOf(21), content)).toMatchObject({
      day: 21,
      season: 'spring',
      dayOfSeason: 1,
      year: 2,
      isNight: false,
    });
    expect(duskTick(21, content) - dawnOf(21)).toBe(2400);
  });

  it('follows the calendar in content', () => {
    const short = {
      ...content,
      calendar: {
        dayTicks: 100,
        daysPerSeason: 2,
        seasons: [
          { id: 'winter' as const, name: 'Winter', nightTicks: 60, riverFrozen: false },
          { id: 'summer' as const, name: 'Summer', nightTicks: 20, riverFrozen: true },
        ],
      },
    };
    expect(calendarAt(0, short)).toMatchObject({ season: 'winter', day: 1 });
    expect(duskTick(1, short)).toBe(40);
    expect(duskTick(3, short)).toBe(280);
    expect(calendarAt(400, short)).toMatchObject({ day: 5, year: 2, season: 'winter' });
    // Frozen by the season's flag, whatever it's called.
    expect(isRiverFrozen(199, short)).toBe(false);
    expect(isRiverFrozen(200, short)).toBe(true);
  });
});
