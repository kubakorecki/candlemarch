// Standing orders (spec, Logistics: Where goods are kept): a Workplace pauses while the village
// holds at least N of its output, and resumes below N. Its workers help carry meanwhile.
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import { isPaused } from '../src/standingOrders';
import type { EntityId, GameState } from '../src/state';
import { amountOnTile } from '../src/stockpiles';
import { content, run, runUntil } from './helpers';

/**
 * A woodcutter's hut at (1,1) (door (1,2), yard (2,1)) and its woodcutter, six trees on row 4, and
 * a 2×2 Stockpile at (8,1). There's no Carrier. IDs: trees 1–6, hut 7, woodcutter 8.
 */
const woods: MapDef = {
  name: 'woods',
  rows: ['..........', '..........', '..........', '..........', '.TTTTTT...', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 1 }],
  stockpiles: [{ x: 8, y: 1, w: 2, h: 2 }],
  villagers: [],
};
const HUT = 7;
const WOODCUTTER = 8;

/** Logs on Stockpiles. */
function piled(s: GameState): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), 'logs');
  }
  return total;
}

/** Logs still standing in trees. */
function inTrees(s: GameState): number {
  return Object.values(s.components.mapObject).reduce((sum, o) => sum + o.amount, 0);
}

/** Logs the village holds: the hut's yard and the Stockpile. */
const held = (s: GameState) => (s.components.building[HUT]?.stock.logs ?? 0) + piled(s);

/** The woods with the hut's standing order at `n`. */
function ordered(n: number): GameState {
  return run(createInitialState(1, woods, content), 1, {
    0: [{ type: 'setStandingOrder', building: HUT, amount: n }],
  });
}

describe('a standing order', () => {
  it('starts at its output’s default from content', () => {
    const s = createInitialState(1, woods, content);
    expect(s.components.building[HUT]?.standingOrder).toBe(content.resources.logs.standingOrder);
  });

  it('pauses the Workplace once the village holds N, and its worker carries meanwhile', () => {
    const before = inTrees(ordered(3));
    const s = run(ordered(3), 3000);
    expect(isPaused(s, content, HUT)).toBe(true);
    // Three logs felled and no more; the woodcutter took them to the Stockpile itself.
    expect(before - inTrees(s)).toBe(3);
    expect(held(s)).toBe(3);
    expect(piled(s)).toBe(3);
    expect(s.components.villager[WOODCUTTER]?.job).toBe('woodcutter');
  });

  it('resumes below N', () => {
    const paused = run(ordered(3), 3000);
    const pile = Object.values(paused.components.stockpile)[0];
    const tile = pile && Object.values(pile.goods)[0];
    if (tile) tile.amount -= 1; // one log used
    expect(isPaused(paused, content, HUT)).toBe(false);
    const resumed = runUntil(paused, (s) => held(s) === 3, 2000);
    expect(held(resumed)).toBe(3);
    expect(inTrees(paused) - inTrees(resumed)).toBe(1);
  });

  it('is set by a command, a whole number from 0, on a Workplace with outputs only', () => {
    const s = createInitialState(
      1,
      { ...woods, buildings: [...woods.buildings, { type: 'hut', x: 5, y: 1 }] },
      content,
    );
    const house = idsOf(s.components.building).find(
      (id) => s.components.building[id]?.type === 'hut',
    ) as EntityId;
    const next = run(s, 1, {
      0: [
        { type: 'setStandingOrder', building: HUT, amount: 12 },
        { type: 'setStandingOrder', building: HUT, amount: -1 },
        { type: 'setStandingOrder', building: HUT, amount: 2.5 },
        { type: 'setStandingOrder', building: house, amount: 5 },
      ],
    });
    expect(next.components.building[HUT]?.standingOrder).toBe(12);
    expect(next.components.building[house]?.standingOrder).toBeNull();
  });

  it('runs the same twice, and through a save', () => {
    const a = run(ordered(3), 2000);
    const b = run(ordered(3), 2000);
    expect(a).toEqual(b);
    const saved = run(ordered(3), 700);
    expect(run(deserialize(serialize(saved), content), 1300)).toEqual(a);
  });
});

describe("the chopping block's firewood", () => {
  it('keeps its old target as the default, and old saves load with it', () => {
    expect(content.resources.firewood.standingOrder).toBe(40);
    const s = createInitialState(
      1,
      { ...woods, buildings: [{ type: 'chopping_block', x: 1, y: 1 }] },
      content,
    );
    const block = idsOf(s.components.building)[0] as EntityId;
    expect(s.components.building[block]?.standingOrder).toBe(40);
    const old = JSON.parse(serialize(s));
    delete old.components.building[block].standingOrder;
    expect(
      deserialize(JSON.stringify(old), content).components.building[block]?.standingOrder,
    ).toBe(40);
  });
});
