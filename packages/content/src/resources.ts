import type { ResourceDef, ResourceId } from './types';

// `standingOrder`: what a Workplace making it keeps the village at before pausing (spec, Logistics:
// Standing orders; numbers Proposed). `price`: what Merchants pay, in hundredths of a coin (spec,
// Economy: Coin; a log about 2 coin, planks 6, hides 8, ale 8, iron bars 15; refined goods about
// 3× their inputs). Cheap bulk goods fall slower per unit sold. Numbers Proposed.
export const resources: Record<ResourceId, ResourceDef> = {
  logs: {
    id: 'logs',
    name: 'Logs',
    storage: 'stockpile',
    standingOrder: 60,
    price: { base: 200, dropPerUnit: 1 },
  },
  // Enough not to turn every log into firewood (spec, Firewood).
  firewood: {
    id: 'firewood',
    name: 'Firewood',
    storage: 'stockpile',
    standingOrder: 40,
    price: { base: 150, dropPerUnit: 1 },
  },
  fish: {
    id: 'fish',
    name: 'Fish',
    storage: 'granary',
    spoilPercent: 15,
    standingOrder: 60,
    price: { base: 150, dropPerUnit: 2 },
  },
  berries: {
    id: 'berries',
    name: 'Berries',
    storage: 'granary',
    spoilPercent: 25,
    standingOrder: 60,
    price: { base: 100, dropPerUnit: 1 },
  },
  mushrooms: {
    id: 'mushrooms',
    name: 'Mushrooms',
    storage: 'granary',
    spoilPercent: 25,
    standingOrder: 60,
    price: { base: 100, dropPerUnit: 1 },
  },
  meat: {
    id: 'meat',
    name: 'Meat',
    storage: 'granary',
    spoilPercent: 15,
    standingOrder: 60,
    price: { base: 200, dropPerUnit: 2 },
  },
  // Piles up until the trade post (M5) can sell it.
  hides: {
    id: 'hides',
    name: 'Hides',
    storage: 'stockpile',
    standingOrder: 30,
    price: { base: 800, dropPerUnit: 10 },
  },
  // Dug from Deposits by the quarry, clay pit and mine; iron ore also from Swamp (bog iron).
  stone: {
    id: 'stone',
    name: 'Stone',
    storage: 'stockpile',
    standingOrder: 60,
    price: { base: 200, dropPerUnit: 2 },
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    storage: 'stockpile',
    standingOrder: 40,
    price: { base: 150, dropPerUnit: 1 },
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron ore',
    storage: 'stockpile',
    standingOrder: 40,
    price: { base: 300, dropPerUnit: 3 },
  },
  // From the farm's Fields: Food eaten as it is, and it keeps long (spec, Spoilage).
  grain: {
    id: 'grain',
    name: 'Grain',
    storage: 'granary',
    spoilPercent: 1,
    standingOrder: 80,
    price: { base: 150, dropPerUnit: 1 },
  },
  // From the charcoal kiln; the bloomery's fuel (M5).
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    storage: 'stockpile',
    standingOrder: 30,
    price: { base: 500, dropPerUnit: 5 },
  },
  // The Carpenter's and Mason's goods (M5 tier 1): building materials, and planks the smithy's.
  planks: {
    id: 'planks',
    name: 'Planks',
    storage: 'stockpile',
    standingOrder: 40,
    price: { base: 600, dropPerUnit: 6 },
  },
  cut_stone: {
    id: 'cut_stone',
    name: 'Cut stone',
    storage: 'stockpile',
    standingOrder: 30,
    price: { base: 600, dropPerUnit: 6 },
  },
  bricks: {
    id: 'bricks',
    name: 'Bricks',
    storage: 'stockpile',
    standingOrder: 30,
    price: { base: 400, dropPerUnit: 4 },
  },
  // The Butcher's smokehouse: Food that keeps (spec, Spoilage: smoked goods about 3%).
  smoked_fish: {
    id: 'smoked_fish',
    name: 'Smoked fish',
    storage: 'granary',
    spoilPercent: 3,
    standingOrder: 40,
    price: { base: 400, dropPerUnit: 4 },
  },
  smoked_meat: {
    id: 'smoked_meat',
    name: 'Smoked meat',
    storage: 'granary',
    spoilPercent: 3,
    standingOrder: 40,
    price: { base: 500, dropPerUnit: 5 },
  },
  // The tier-2 goods the Tavern needs (M5): the Smith's iron bars, the Brewer's ale. Stockpile
  // goods: ale is drunk at the Tavern (M6), not eaten as a Meal.
  iron_bars: {
    id: 'iron_bars',
    name: 'Iron bars',
    storage: 'stockpile',
    standingOrder: 20,
    price: { base: 1500, dropPerUnit: 30 },
  },
  ale: {
    id: 'ale',
    name: 'Ale',
    storage: 'stockpile',
    standingOrder: 30,
    price: { base: 800, dropPerUnit: 12 },
  },
  // Tools (spec, Economy: Tools): imported or found in Ruins until the M6 smithy. Worth about 40
  // coin, one of the best sellers.
  tools: {
    id: 'tools',
    name: 'Tools',
    storage: 'stockpile',
    price: { base: 4000, dropPerUnit: 50 },
  },
};
