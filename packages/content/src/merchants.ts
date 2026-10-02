import type { MerchantsDef } from './types';

// Merchants at the trade post (spec, Economy: The trade post in M5). Numbers Proposed.
export const merchants: MerchantsDef = {
  everyDays: 3,
  closedSeasons: ['winter'], // the roads are snowed in
  wanted: { min: 2, max: 3 },
  wantedBonusPercent: 50,
  floorPercent: 30,
  recoverPercent: 10,
};
