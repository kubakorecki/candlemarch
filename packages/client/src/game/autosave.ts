// Save slots, and when the game autosaves: at each Dawn but the one a new game starts on. Pure,
// so the worker can use it; the main thread does the localStorage writes.
import type { Content, SeasonId } from '@candlemarch/content';
import { type CalendarTime, calendarAt, isDawn } from '@candlemarch/sim';

export type SaveSlot = 'manual' | 'autosave';

/** Each slot's localStorage key and name, in the order the Load menu lists them. */
export const SAVE_SLOTS: Record<SaveSlot, { key: string; name: string }> = {
  manual: { key: 'candlemarch.save', name: 'Save' },
  autosave: { key: 'candlemarch.autosave', name: 'Autosave' },
};

/**
 * Whether the sim, having just reached `tick`, should autosave: `tick` is a Dawn the game didn't
 * start on. The save holds the state at the start of that day, before its Dawn runs.
 */
export function isAutosaveTick(tick: number, content: Content): boolean {
  return tick > 0 && isDawn(tick, content);
}

/** "Spring": a season's name. */
export function seasonName(season: SeasonId, content: Content): string {
  return content.calendar.seasons.find((s) => s.id === season)?.name ?? season;
}

/** "Spring, day 3": the season's name and the day within it. */
export function dateLabel(time: CalendarTime, content: Content): string {
  return `${seasonName(time.season, content)}, day ${time.dayOfSeason}`;
}

/** What the Load menu shows for a save made at `tick`, e.g. "Spring, day 3, year 1". */
export function slotDateLabel(tick: number, content: Content): string {
  const time = calendarAt(tick, content);
  return `${dateLabel(time, content)}, year ${time.year}`;
}
