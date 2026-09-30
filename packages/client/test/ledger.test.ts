import { content } from '@candlemarch/content';
import { createInitialState, type MapDef } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { ledgerGoods, stockpileGoods } from '../src/game/ledger';

// A Granary with meat and two stockpiles: logs on one, logs and firewood on the other.
const camp: MapDef = {
  name: 'camp',
  rows: ['........', '........', '........'],
  buildings: [{ type: 'granary', x: 0, y: 0, stock: [{ resource: 'meat', amount: 20 }] }],
  stockpiles: [
    { x: 3, y: 0, w: 2, h: 2, goods: [{ resource: 'logs', amount: 30 }] },
    {
      x: 6,
      y: 0,
      w: 2,
      h: 2,
      goods: [
        { resource: 'logs', amount: 5 },
        { resource: 'firewood', amount: 12 },
      ],
    },
  ],
  villagers: [],
};

describe('stockpile goods', () => {
  it('adds up every Stockpile tile by resource, Granary Food left out', () => {
    const s = createInitialState(1, camp, content);
    expect(stockpileGoods(s)).toEqual({ logs: 35, firewood: 12 });
  });

  it('is empty without Stockpiles', () => {
    const s = createInitialState(1, { ...camp, stockpiles: [] }, content);
    expect(stockpileGoods(s)).toEqual({});
  });
});

describe('Ledger goods', () => {
  it('lists the Stockpile goods some building makes, in content order', () => {
    expect(ledgerGoods(content, {})).toEqual(['logs', 'firewood', 'hides']);
  });

  it('adds a good nothing makes yet once some lies on a Stockpile', () => {
    expect(ledgerGoods(content, { clay: 3, stone: 0 })).toEqual([
      'logs',
      'firewood',
      'hides',
      'clay',
    ]);
  });
});
