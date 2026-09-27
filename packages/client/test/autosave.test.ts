import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { isAutosaveTick, SAVE_SLOTS, slotDateLabel } from '../src/game/autosave';

// A day is 3600 ticks; day 2's Dawn is tick 3600. Seasons last 5 days; day 6 is summer's first.
const DAY = 3600;

describe('autosave at Dawn', () => {
  it('saves when the sim reaches a Dawn after the first', () => {
    expect(isAutosaveTick(DAY, content)).toBe(true);
    expect(isAutosaveTick(5 * DAY, content)).toBe(true);
  });

  it('never saves the start of a new game', () => {
    expect(isAutosaveTick(0, content)).toBe(false);
  });

  it('saves once a day: not at any other tick', () => {
    expect(isAutosaveTick(DAY - 1, content)).toBe(false);
    expect(isAutosaveTick(DAY + 1, content)).toBe(false);
    expect(isAutosaveTick(DAY + 2400, content)).toBe(false);
  });

  it('keeps the autosave apart from the manual save', () => {
    expect(SAVE_SLOTS.autosave.key).toBe('candlemarch.autosave');
    expect(SAVE_SLOTS.manual.key).toBe('candlemarch.save');
  });

  it('labels a slot with its day and season', () => {
    expect(slotDateLabel(DAY, content)).toBe('Spring, day 2, year 1');
    expect(slotDateLabel(5 * DAY, content)).toBe('Summer, day 1, year 1');
  });
});
