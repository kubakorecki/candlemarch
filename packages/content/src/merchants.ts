import type { MerchantsDef } from './types';

// Merchants at the trade post (spec, Economy: The trade post in M5). Numbers Proposed.
export const merchants: MerchantsDef = {
  everyDays: 3,
  closedSeasons: ['winter'], // the roads are snowed in
  wanted: { min: 2, max: 3 },
  wantedBonusPercent: 50,
  floorPercent: 30,
  recoverPercent: 10,
  // Imports (spec, Economy: Imports): what the Valley can run out of or not make yet. Goods the
  // village should make (planks, ale) are left out on purpose. Tools (ticket 16) and turnip seeds
  // (ticket 25) join the catalogue with their tickets.
  imports: ['stone', 'clay', 'iron_ore', 'iron_bars', 'grain'],
  importPricePercent: 200,
};
