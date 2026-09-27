// Milestone 0: logs are gathered, carried and turned into a hut.
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * Tick limit for one hut on the meadow map. Measured completion: tick 2127 (10 logs, last one
 * delivered at 1928, plus 200 build ticks). 3200 is about 1.5× that, so small tuning or
 * pathing changes don't break the test, while a real stall still does.
 */
const HUT_TICK_LIMIT = 3200;
const HUT_AT = { x: 4, y: 16 };

const placeHut: Record<number, Command[]> = {
  0: [{ type: 'placeBuilding', building: 'hut', ...HUT_AT }],
};

/**
 * A busier script: two huts, one of them cancelled mid-way, an invalid placement, a dirt path
 * from the woodcutter's hut door (9,13) to the first hut's door (4,17), part of which is
 * removed later, two stockpiles, one of them removed later, and the hero walking about.
 */
const script: Record<number, Command[]> = {
  0: [
    { type: 'placeBuilding', building: 'hut', x: 4, y: 16 },
    { type: 'layPath', from: { x: 9, y: 13 }, to: { x: 5, y: 17 } },
    { type: 'layPath', from: { x: 5, y: 17 }, to: { x: 4, y: 17 } },
    { type: 'layPath', from: { x: 3, y: 16 }, to: { x: 6, y: 16 } }, // through the hut: ignored
  ],
  30: [{ type: 'orderHero', order: 'move', x: 20, y: 20 }],
  45: [{ type: 'orderHero', order: 'move', x: 2, y: 22 }], // replaces the walk mid-way
  50: [
    { type: 'placeBuilding', building: 'hut', x: 18, y: 18 },
    { type: 'placeBuilding', building: 'hut', x: 13, y: 6 }, // on a tree: ignored
  ],
  60: [
    { type: 'placeStockpile', x: 14, y: 15, w: 3, h: 2 },
    { type: 'placeStockpile', x: 2, y: 20, w: 2, h: 1 },
  ],
  700: [{ type: 'cancelConstruction', siteId: 23 }], // the second hut
  1200: [{ type: 'orderHero', order: 'move', x: 12, y: 12 }],
  1500: [{ type: 'removePath', from: { x: 5, y: 15 }, to: { x: 5, y: 16 } }],
  2500: [{ type: 'removeStockpile', id: 25 }],
};

const fresh = (seed = 1) => createInitialState(seed, meadowMap, content);

function huts(s: GameState): number[] {
  return idsOf(s.components.building).filter((id) => s.components.building[id]?.type === 'hut');
}

describe('milestone 0', () => {
  it(`a placed hut is finished within ${HUT_TICK_LIMIT} ticks`, () => {
    const end = runUntil(fresh(), (s) => huts(s).length === 1, HUT_TICK_LIMIT, placeHut);
    expect(huts(end)).toHaveLength(1);
    expect(end.tick).toBeLessThanOrEqual(HUT_TICK_LIMIT);

    const hutId = huts(end)[0] as number;
    expect(end.components.tile[hutId]).toEqual(HUT_AT);
    expect(idsOf(end.components.site)).toHaveLength(0);
    // Trees really were chopped for it.
    const logsInTrees = Object.values(end.components.mapObject).reduce((n, o) => n + o.amount, 0);
    expect(logsInTrees).toBeLessThanOrEqual(17 * 3 - 10);
  });

  it('is deterministic: same seed and commands give identical state', () => {
    const a = run(fresh(7), 3000, script);
    const b = run(fresh(7), 3000, script);
    expect(a).toEqual(b);
    // The script really exercised the cancel. IDs: trees 1-17, woodcutter's hut 18,
    // woodcutter 19, carrier 20, hero 21, first site 22, second site 23, stockpiles 24
    // and 25.
    expect(a.components.site[23]).toBeUndefined();
    expect(a.components.building[23]).toBeUndefined();
    expect(huts(a)).toHaveLength(1);
    // 10 path tiles laid, 2 removed.
    expect(Object.keys(a.map.roads)).toHaveLength(8);
    // Once the hut was done, logs went to the stockpiles; one of them was removed.
    expect(idsOf(a.components.stockpile)).toEqual([24]);
    expect(Object.keys(a.components.stockpile[24]?.goods ?? {}).length).toBeGreaterThan(0);
  });

  // 1234: the first hut is being supplied. 2700: logs are going to the stockpile.
  it.each([1234, 2700])(
    'save/load at tick %i continues exactly like an uninterrupted run',
    (at) => {
      const uninterrupted = run(fresh(3), 3000, script);

      const midway = run(fresh(3), at, script);
      const loaded = deserialize(serialize(midway), content);
      const resumed = run(loaded, 3000 - at, script);

      expect(resumed).toEqual(uninterrupted);
    },
  );
});
