import { content } from '@candlemarch/content';
import { createInitialState, idsOf } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { syntheticMap } from './syntheticMap';

describe('syntheticMap', () => {
  it('builds a size×size map a game can start on, with 50 villagers', () => {
    const state = createInitialState(1, syntheticMap(64), content);
    expect(state.map.width).toBe(64);
    expect(state.map.height).toBe(64);
    expect(idsOf(state.components.villager)).toHaveLength(50);
    expect(Object.keys(state.map.roads).length).toBeGreaterThan(0);
  });

  it('keeps the village the same at every size and grows the forest with the area', () => {
    const small = createInitialState(1, syntheticMap(64), content);
    const large = createInitialState(1, syntheticMap(128), content);
    const count = (s: typeof small) => ({
      buildings: idsOf(s.components.building).length,
      stockpiles: idsOf(s.components.stockpile).length,
      villagers: idsOf(s.components.villager).length,
    });
    expect(count(large)).toEqual(count(small));
    const trees = (s: typeof small) =>
      Object.values(s.components.mapObject).filter((o) => o.type === 'tree').length;
    expect(trees(large)).toBeGreaterThan(3 * trees(small));
  });

  it('gives the same map for the same size', () => {
    expect(syntheticMap(96)).toEqual(syntheticMap(96));
  });
});
