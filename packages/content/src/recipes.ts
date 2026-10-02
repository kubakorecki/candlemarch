import type { RecipeDef, RecipeId } from './types';

export const recipes: Record<RecipeId, RecipeDef> = {
  split_logs: {
    id: 'split_logs',
    name: 'Split logs',
    inputs: [{ resource: 'logs', amount: 1 }],
    outputs: [{ resource: 'firewood', amount: 2 }],
    workTicks: 40, // 2 s, as long as a chop
  },
  // Numbers Proposed: a slow burn, and charcoal costs its logs.
  burn_charcoal: {
    id: 'burn_charcoal',
    name: 'Burn charcoal',
    inputs: [{ resource: 'logs', amount: 3 }],
    outputs: [{ resource: 'charcoal', amount: 2 }],
    workTicks: 200, // 10 s
  },
  // The tier-1 master workshops (M5). Numbers Proposed.
  saw_planks: {
    id: 'saw_planks',
    name: 'Saw planks',
    inputs: [{ resource: 'logs', amount: 1 }],
    outputs: [{ resource: 'planks', amount: 2 }],
    workTicks: 80, // 4 s
  },
  dress_stone: {
    id: 'dress_stone',
    name: 'Cut stone',
    inputs: [{ resource: 'stone', amount: 1 }],
    outputs: [{ resource: 'cut_stone', amount: 1 }],
    workTicks: 100, // 5 s
  },
  fire_bricks: {
    id: 'fire_bricks',
    name: 'Fire bricks',
    inputs: [
      { resource: 'clay', amount: 2 },
      { resource: 'firewood', amount: 1 },
    ],
    outputs: [{ resource: 'bricks', amount: 3 }],
    workTicks: 200, // 10 s
  },
  smoke_fish: {
    id: 'smoke_fish',
    name: 'Smoke fish',
    inputs: [
      { resource: 'fish', amount: 3 },
      { resource: 'firewood', amount: 1 },
    ],
    outputs: [{ resource: 'smoked_fish', amount: 3 }],
    workTicks: 200, // 10 s
  },
  smoke_meat: {
    id: 'smoke_meat',
    name: 'Smoke meat',
    inputs: [
      { resource: 'meat', amount: 3 },
      { resource: 'firewood', amount: 1 },
    ],
    outputs: [{ resource: 'smoked_meat', amount: 3 }],
    workTicks: 200, // 10 s
  },
  // The tier-2 workshops the Tavern needs (M5). Numbers Proposed.
  smelt_iron: {
    id: 'smelt_iron',
    name: 'Smelt iron',
    inputs: [
      { resource: 'iron_ore', amount: 2 },
      { resource: 'charcoal', amount: 1 },
    ],
    outputs: [{ resource: 'iron_bars', amount: 1 }],
    workTicks: 300, // 15 s
  },
  brew_ale: {
    id: 'brew_ale',
    name: 'Brew ale',
    inputs: [
      { resource: 'grain', amount: 2 },
      { resource: 'firewood', amount: 1 },
    ],
    outputs: [{ resource: 'ale', amount: 2 }],
    workTicks: 300, // 15 s
  },
};
