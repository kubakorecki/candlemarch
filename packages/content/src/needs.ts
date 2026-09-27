import type { NeedsDef } from './types';

export const needs: NeedsDef = {
  // Under half a night's sleep at Home: half speed the next day.
  tired: { minSleepPercent: 50, speedPercent: 50 },
  // One unit of Food a Meal; a missed Meal: half speed; the third missed in a row starves.
  hungry: { mealUnits: 1, speedPercent: 50, starveAfterMissedMeals: 3 },
};
