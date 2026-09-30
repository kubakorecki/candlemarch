import type { HuntingDef } from './types';

export const hunting: HuntingDef = {
  forest: 'tree',
  // 50% at max Game: "catch chance = 50% × game ÷ max game".
  maxCatchPermille: 500,
  thrivingPercent: 75,
  scarcePercent: 25,
  recoveryDays: 2,
  emptySeasons: 2,
  returningGame: 2,
};
