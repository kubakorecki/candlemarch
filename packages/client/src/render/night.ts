// How dark the world is drawn at a tick. Presentation only: the sim decides when night is.
import type { Content } from '@candlemarch/content';
import { calendarAt, duskTick, TICKS_PER_SECOND } from '@candlemarch/sim';

/** Ticks the tint takes to fade in after Dusk, and to fade out before Dawn. */
export const NIGHT_FADE_TICKS = 10 * TICKS_PER_SECOND;

/** 0 by day, rising to 1 over the first ticks of night and back to 0 by Dawn. */
export function nightDarkness(tick: number, content: Content): number {
  const time = calendarAt(tick, content);
  if (!time.isNight) return 0;
  const sinceDusk = tick - duskTick(time.day, content);
  const untilDawn = content.calendar.dayTicks - time.timeOfDay;
  return Math.min(1, sinceDusk / NIGHT_FADE_TICKS, untilDawn / NIGHT_FADE_TICKS);
}
