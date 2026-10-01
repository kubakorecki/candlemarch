import type { ResourceDef, ResourceId } from './types';

// `standingOrder`: what a Workplace making it keeps the village at before pausing (spec, Logistics:
// Standing orders; numbers Proposed).
export const resources: Record<ResourceId, ResourceDef> = {
  logs: { id: 'logs', name: 'Logs', storage: 'stockpile', standingOrder: 60 },
  // Enough not to turn every log into firewood (spec, Firewood).
  firewood: { id: 'firewood', name: 'Firewood', storage: 'stockpile', standingOrder: 40 },
  fish: { id: 'fish', name: 'Fish', storage: 'granary', spoilPercent: 15, standingOrder: 60 },
  berries: {
    id: 'berries',
    name: 'Berries',
    storage: 'granary',
    spoilPercent: 25,
    standingOrder: 60,
  },
  mushrooms: {
    id: 'mushrooms',
    name: 'Mushrooms',
    storage: 'granary',
    spoilPercent: 25,
    standingOrder: 60,
  },
  meat: { id: 'meat', name: 'Meat', storage: 'granary', spoilPercent: 15, standingOrder: 60 },
  // Piles up until the trade post (M5) can sell it.
  hides: { id: 'hides', name: 'Hides', storage: 'stockpile', standingOrder: 30 },
  // Dug from Deposits once M5's quarry, clay pit and mine exist.
  stone: { id: 'stone', name: 'Stone', storage: 'stockpile' },
  clay: { id: 'clay', name: 'Clay', storage: 'stockpile' },
  iron_ore: { id: 'iron_ore', name: 'Iron ore', storage: 'stockpile' },
};
