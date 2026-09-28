// How the world looks through the evening and night. Presentation only: the sim decides when night
// is and what glows (`lightSources`); this only shapes the fade.
import type { Content } from '@candlemarch/content';
import { calendarAt, duskTick, TICKS_PER_SECOND } from '@candlemarch/sim';
import { palette } from './palette';

/** Ticks before Dusk over which daylight warms to the dusk colour. */
export const EVENING_TICKS = 20 * TICKS_PER_SECOND;
/** Ticks after Dusk over which the dark deepens to full night. */
export const DUSK_TICKS = 20 * TICKS_PER_SECOND;
/** Ticks before Dawn over which the dark lifts back to daylight. */
export const DAWN_TICKS = 15 * TICKS_PER_SECOND;

/** How far into the dark the dusk colour sits, on the 0 (day) to 1 (full night) scale. */
const DUSK_LEVEL = 0.3;
const DAYLIGHT = 0xffffff;

/**
 * `tint` multiplies the whole world (white by day, `palette.dusk` at Dusk, `palette.night` at full
 * dark); `glow` is how strongly light sources shine, 0 until Dusk and 1 at full dark.
 */
export interface NightLook {
  tint: number;
  glow: number;
}

export function nightLook(tick: number, content: Content): NightLook {
  const level = darkness(tick, content);
  const glow = Math.max(0, (level - DUSK_LEVEL) / (1 - DUSK_LEVEL));
  const tint =
    level <= DUSK_LEVEL
      ? mix(DAYLIGHT, palette.dusk, level / DUSK_LEVEL)
      : mix(palette.dusk, palette.night, glow);
  return { tint, glow };
}

/** 0 by day, rising through the evening to `DUSK_LEVEL` at Dusk and 1 at full night. */
function darkness(tick: number, content: Content): number {
  const time = calendarAt(tick, content);
  const dusk = duskTick(time.day, content);
  if (!time.isNight) return DUSK_LEVEL * Math.max(0, 1 - (dusk - tick) / EVENING_TICKS);
  const deepening = DUSK_LEVEL + (1 - DUSK_LEVEL) * Math.min(1, (tick - dusk) / DUSK_TICKS);
  const lifting = (content.calendar.dayTicks - time.timeOfDay) / DAWN_TICKS;
  return Math.min(deepening, lifting);
}

/** Colour `t` of the way from `a` to `b` (0..1), channel by channel. */
function mix(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    out |= Math.round(from + (to - from) * t) << shift;
  }
  return out;
}
