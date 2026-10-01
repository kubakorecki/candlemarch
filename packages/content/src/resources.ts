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
  // Dug from Deposits by the quarry, clay pit and mine; iron ore also from Swamp (bog iron).
  stone: { id: 'stone', name: 'Stone', storage: 'stockpile', standingOrder: 60 },
  clay: { id: 'clay', name: 'Clay', storage: 'stockpile', standingOrder: 40 },
  iron_ore: { id: 'iron_ore', name: 'Iron ore', storage: 'stockpile', standingOrder: 40 },
  // From the farm's Fields: Food eaten as it is, and it keeps long (spec, Spoilage).
  grain: { id: 'grain', name: 'Grain', storage: 'granary', spoilPercent: 1, standingOrder: 80 },
  // From the charcoal kiln; the bloomery's fuel (M5).
  charcoal: { id: 'charcoal', name: 'Charcoal', storage: 'stockpile', standingOrder: 30 },
  // The Carpenter's and Mason's goods (M5 tier 1): building materials, and planks the smithy's.
  planks: { id: 'planks', name: 'Planks', storage: 'stockpile', standingOrder: 40 },
  cut_stone: { id: 'cut_stone', name: 'Cut stone', storage: 'stockpile', standingOrder: 30 },
  bricks: { id: 'bricks', name: 'Bricks', storage: 'stockpile', standingOrder: 30 },
  // The Butcher's smokehouse: Food that keeps (spec, Spoilage: smoked goods about 3%).
  smoked_fish: {
    id: 'smoked_fish',
    name: 'Smoked fish',
    storage: 'granary',
    spoilPercent: 3,
    standingOrder: 40,
  },
  smoked_meat: {
    id: 'smoked_meat',
    name: 'Smoked meat',
    storage: 'granary',
    spoilPercent: 3,
    standingOrder: 40,
  },
};
