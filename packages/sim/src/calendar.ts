// Days, nights and seasons, derived from `state.tick` and the content calendar; nothing is stored.
// Tick 0 is Dawn on day 1 of the first season, year 1. Each day runs from Dawn to Dawn and its
// last `nightTicks` (set by its season) are night, starting at Dusk.
import type { Content, SeasonDef, SeasonId } from '@candlemarch/content';

export interface CalendarTime {
  /** Days since the game began, counting from 1. */
  day: number;
  season: SeasonId;
  /** Day within the season, counting from 1. */
  dayOfSeason: number;
  /** Counting from 1. */
  year: number;
  /** Ticks since this day's Dawn. */
  timeOfDay: number;
  /** Between Dusk and the next Dawn. */
  isNight: boolean;
}

/** The season day `day` (counting from 1) falls in. */
function seasonOfDay(day: number, content: Content): SeasonDef {
  const { daysPerSeason, seasons } = content.calendar;
  const index = Math.floor((day - 1) / daysPerSeason) % seasons.length;
  return seasons[index] as SeasonDef;
}

/** Ticks from Dawn to Dusk on day `day`. */
function daylightTicks(day: number, content: Content): number {
  return content.calendar.dayTicks - seasonOfDay(day, content).nightTicks;
}

/** Day, season, year and time of day at `tick`. */
export function calendarAt(tick: number, content: Content): CalendarTime {
  const { dayTicks, daysPerSeason, seasons } = content.calendar;
  const day = Math.floor(tick / dayTicks) + 1;
  const timeOfDay = tick % dayTicks;
  const daysPerYear = daysPerSeason * seasons.length;
  return {
    day,
    season: seasonOfDay(day, content).id,
    dayOfSeason: ((day - 1) % daysPerSeason) + 1,
    year: Math.floor((day - 1) / daysPerYear) + 1,
    timeOfDay,
    isNight: timeOfDay >= daylightTicks(day, content),
  };
}

export function isNight(tick: number, content: Content): boolean {
  return calendarAt(tick, content).isNight;
}

/** The tick day `day` (counting from 1) begins: its Dawn. */
export function dawnTick(day: number, content: Content): number {
  return (day - 1) * content.calendar.dayTicks;
}

/** The tick night begins on day `day` (counting from 1). */
export function duskTick(day: number, content: Content): number {
  return dawnTick(day, content) + daylightTicks(day, content);
}

/** `tick` is exactly a Dawn. */
export function isDawn(tick: number, content: Content): boolean {
  return tick % content.calendar.dayTicks === 0;
}

/** `tick` is exactly a Dusk. */
export function isDusk(tick: number, content: Content): boolean {
  return tick === duskTick(calendarAt(tick, content).day, content);
}
