import type { NeedsDef } from './types';

export const needs: NeedsDef = {
  // Under half a night's sleep at Home: half speed the next day.
  tired: { minSleepPercent: 50, speedPercent: 50 },
  // One unit of Food a Meal; a missed Meal: half speed; the third missed in a row starves.
  hungry: { mealUnits: 1, speedPercent: 50, starveAfterMissedMeals: 3 },
  // Houses hold 5 firewood, fetched from the start of autumn, and burn 1 a winter night. A cold
  // night: half speed; the second in a row freezes (faster than starving, on purpose).
  cold: {
    fuel: 'firewood',
    houseBuffer: 5,
    burnPerNight: 1,
    stockUpSeasons: ['autumn', 'winter'],
    coldSeasons: ['winter'],
    speedPercent: 50,
    freezeAfterColdNights: 2,
  },
};
