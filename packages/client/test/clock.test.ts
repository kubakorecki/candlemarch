import { describe, expect, it } from 'vitest';
import { TICK_MS, tickClock, tickFraction } from '../src/game/clock';

describe('clock', () => {
  it('runs 20 ticks per real second at 1×, 60 at 3×, none when paused', () => {
    for (const [speed, expected] of [
      [1, 20],
      [3, 60],
      [0, 0],
    ] as const) {
      const clock = { accumulator: 0 };
      let ticks = 0;
      for (let i = 0; i < 60; i++) ticks += tickClock(clock, 1000 / 60, speed);
      expect(ticks).toBe(expected);
    }
  });

  it('keeps the remainder for interpolation', () => {
    const clock = { accumulator: 0 };
    expect(tickClock(clock, TICK_MS * 1.5, 1)).toBe(1);
    expect(tickFraction(clock)).toBeCloseTo(0.5);
  });

  it('drops long gaps instead of catching up', () => {
    const clock = { accumulator: 0 };
    expect(tickClock(clock, 10_000, 1)).toBe(5); // capped at 250 ms
  });
});
