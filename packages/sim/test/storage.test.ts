import { describe, expect, it } from 'vitest';
import { createInitialState, type MapDef } from '../src/map';
import { storageOf } from '../src/storage';
import { content } from './helpers';

// A Granary (ID 1) holding meat and berries, a Hut (ID 2), and a Carrier.
const camp: MapDef = {
  name: 'storage',
  rows: ['........', '........', '........', '........'],
  buildings: [
    {
      type: 'granary',
      x: 1,
      y: 0,
      stock: [
        { resource: 'meat', amount: 7 },
        { resource: 'berries', amount: 5 },
      ],
    },
    { type: 'hut', x: 5, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 0, y: 3 }],
};

describe("a building's Storage", () => {
  it("is a Granary's Food: a line per Food it holds, the total and its capacity", () => {
    const s = createInitialState(1, camp, content);
    expect(storageOf(s, content, 1)).toEqual({
      goods: [
        { resource: 'berries', amount: 5 },
        { resource: 'meat', amount: 7 },
      ],
      amount: 12,
      capacity: 100,
    });
  });

  it('follows what the Granary holds, and lists no line for a Food it has none of', () => {
    const s = createInitialState(1, camp, content);
    const granary = s.components.building[1];
    if (!granary) throw new Error('no Granary');
    granary.stock.berries = 0;
    granary.stock.fish = 3;
    expect(storageOf(s, content, 1)).toEqual({
      goods: [
        { resource: 'fish', amount: 3 },
        { resource: 'meat', amount: 7 },
      ],
      amount: 10,
      capacity: 100,
    });
  });

  it("is nothing for a building that keeps no Storage, or one that's gone", () => {
    const s = createInitialState(1, camp, content);
    expect(storageOf(s, content, 2)).toBeNull();
    expect(storageOf(s, content, 99)).toBeNull();
  });
});
