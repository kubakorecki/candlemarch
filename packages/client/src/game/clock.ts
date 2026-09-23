// Turns real time × game speed into whole sim ticks. See CLAUDE.md "Fixed tick rate".
import { TICKS_PER_SECOND } from '@candlemarch/sim';

export const TICK_MS = 1000 / TICKS_PER_SECOND;
export const SPEEDS = [0, 1, 2, 3] as const;
export type Speed = (typeof SPEEDS)[number];

/** Longest frame we account for; longer gaps (e.g. a background tab) are dropped. */
const MAX_FRAME_MS = 250;

export interface ClockState {
  /** Game-time milliseconds not yet turned into ticks. */
  accumulator: number;
}

/** Adds one frame of real time; returns how many ticks are now due. */
export function tickClock(clock: ClockState, frameMs: number, speed: Speed): number {
  clock.accumulator += Math.min(frameMs, MAX_FRAME_MS) * speed;
  const due = Math.floor(clock.accumulator / TICK_MS);
  clock.accumulator -= due * TICK_MS;
  return due;
}

/** How far into the next tick we are, 0..1, for interpolation. */
export function tickFraction(clock: ClockState): number {
  return Math.min(1, clock.accumulator / TICK_MS);
}
