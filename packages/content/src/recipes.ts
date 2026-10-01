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
};
