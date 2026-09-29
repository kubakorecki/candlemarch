// The Almanac's day track: where the day is between two Dawns, and what to call that time. Pure;
// the phase words follow the night look (`render/night.ts`), so the label changes as the sky does.
import type { Content } from '@candlemarch/content';
import { calendarAt, dawnTick, duskTick } from '@candlemarch/sim';
import { DAWN_TICKS, DUSK_TICKS, EVENING_TICKS } from '../render/night';

/** Steps the track moves in from Dawn to Dawn, so the HUD redraws about once a second, not every tick. */
export const DAY_TRACK_STEPS = 200;

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayTrack {
  /** Dusk: the evening warming before Dusk and the dark deepening after it. Dawn: the dark lifting. */
  phase: DayPhase;
  /** How far the day is from its Dawn to the next, 0 to 1, in `DAY_TRACK_STEPS` steps. */
  progress: number;
  /** Where Dusk falls on the same scale; later in summer than in winter. */
  duskAt: number;
}

export function dayTrack(tick: number, content: Content): DayTrack {
  const { dayTicks } = content.calendar;
  const time = calendarAt(tick, content);
  const dusk = duskTick(time.day, content);
  return {
    phase: phaseAt(tick, dusk, time.timeOfDay, dayTicks),
    progress: Math.floor((time.timeOfDay / dayTicks) * DAY_TRACK_STEPS) / DAY_TRACK_STEPS,
    duskAt: (dusk - dawnTick(time.day, content)) / dayTicks,
  };
}

function phaseAt(tick: number, dusk: number, timeOfDay: number, dayTicks: number): DayPhase {
  if (tick < dusk) return dusk - tick <= EVENING_TICKS ? 'dusk' : 'day';
  if (tick - dusk < DUSK_TICKS) return 'dusk';
  return dayTicks - timeOfDay <= DAWN_TICKS ? 'dawn' : 'night';
}
