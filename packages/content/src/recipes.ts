import type { RecipeDef, RecipeId } from './types';

export const recipes: Record<RecipeId, RecipeDef> = {
  split_logs: {
    id: 'split_logs',
    name: 'Split logs',
    inputs: [{ resource: 'logs', amount: 1 }],
    outputs: [{ resource: 'firewood', amount: 2 }],
    workTicks: 40, // 2 s, as long as a chop
  },
};
