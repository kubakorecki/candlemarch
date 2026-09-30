import type { ResourceDef, ResourceId } from './types';

export const resources: Record<ResourceId, ResourceDef> = {
  logs: { id: 'logs', name: 'Logs', storage: 'stockpile' },
  firewood: { id: 'firewood', name: 'Firewood', storage: 'stockpile' },
  fish: { id: 'fish', name: 'Fish', storage: 'granary', spoilPercent: 25 },
  berries: { id: 'berries', name: 'Berries', storage: 'granary', spoilPercent: 35 },
  mushrooms: { id: 'mushrooms', name: 'Mushrooms', storage: 'granary', spoilPercent: 35 },
  meat: { id: 'meat', name: 'Meat', storage: 'granary', spoilPercent: 25 },
  // Piles up until the trade post (M5) can sell it.
  hides: { id: 'hides', name: 'Hides', storage: 'stockpile' },
  // Dug from Deposits once M5's quarry, clay pit and mine exist.
  stone: { id: 'stone', name: 'Stone', storage: 'stockpile' },
  clay: { id: 'clay', name: 'Clay', storage: 'stockpile' },
  iron_ore: { id: 'iron_ore', name: 'Iron ore', storage: 'stockpile' },
};
