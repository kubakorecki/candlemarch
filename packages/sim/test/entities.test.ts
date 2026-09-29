// ID-ordered iteration: `idsOf` gives a store's entity IDs in ascending order.
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import type { Store } from '../src/state';

describe('idsOf', () => {
  it('lists IDs in ascending order, whatever order they were added in', () => {
    const store: Store<string> = {};
    for (const id of [40, 3, 1000, 7, 12, 100000, 2]) store[id] = 'x';
    delete store[12];
    store[5] = 'y';
    expect(idsOf(store)).toEqual([2, 3, 5, 7, 40, 1000, 100000]);
  });

  it('keeps that order after a save round trip', () => {
    const store: Store<number> = { 9: 1, 4: 2, 250: 3, 1: 4 };
    expect(idsOf(JSON.parse(JSON.stringify(store)) as Store<number>)).toEqual([1, 4, 9, 250]);
  });
});
