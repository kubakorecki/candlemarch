import type { NeedsDef } from './types';

export const needs: NeedsDef = {
  // Under half a night's sleep at Home: half speed the next day.
  tired: { minSleepPercent: 50, speedPercent: 50 },
};
