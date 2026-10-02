import type { DeliveriesDef } from './types';

// Delivery orders on the notice board (spec, Trades and masters: Side quests in M5). Numbers
// Proposed: each pays about twice what Merchants would give for the goods at base price.
export const deliveries: DeliveriesDef = {
  gapDays: 3,
  orders: [
    { resource: 'logs', amount: 40, days: 6, reward: 150 },
    { resource: 'firewood', amount: 40, days: 6, reward: 120 },
    { resource: 'stone', amount: 30, days: 8, reward: 120 },
    { resource: 'hides', amount: 10, days: 10, reward: 160 },
    { resource: 'grain', amount: 40, days: 10, reward: 120 },
    { resource: 'charcoal', amount: 20, days: 8, reward: 200 },
    { resource: 'planks', amount: 20, days: 8, reward: 240 },
    { resource: 'cut_stone', amount: 20, days: 8, reward: 240 },
    { resource: 'bricks', amount: 30, days: 10, reward: 240 },
    { resource: 'smoked_fish', amount: 30, days: 10, reward: 200 },
    { resource: 'smoked_meat', amount: 20, days: 10, reward: 200 },
    { resource: 'iron_bars', amount: 8, days: 10, reward: 240 },
    { resource: 'ale', amount: 20, days: 10, reward: 300 },
  ],
};
