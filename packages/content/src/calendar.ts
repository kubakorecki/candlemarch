import type { CalendarDef } from './types';

// 20 ticks per second: a day is 3 minutes, a year of 4 seasons × 5 days about an hour at 1×.
export const calendar: CalendarDef = {
  dayTicks: 3600,
  daysPerSeason: 5,
  seasons: [
    { id: 'spring', name: 'Spring', nightTicks: 1200, riverFrozen: false }, // 1 minute of the 3
    { id: 'summer', name: 'Summer', nightTicks: 1200, riverFrozen: false },
    { id: 'autumn', name: 'Autumn', nightTicks: 1200, riverFrozen: false },
    // 1.5 minutes of night: less work time, colder nights.
    { id: 'winter', name: 'Winter', nightTicks: 1800, riverFrozen: true },
  ],
};
