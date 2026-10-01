// Helping carry (spec, Logistics: Where goods are kept): a worker whose Workplace can't use them
// right now takes Hauls like a Carrier, keeping its Job, and goes back to work once it can.
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { amountOnTile } from '../src/stockpiles';
import { carrierUtilization } from '../src/traffic';
import { isHelpingCarry } from '../src/villagers';
import { content, run, runUntil } from './helpers';

const FULL = content.logistics.yardCapacity;

/**
 * A woodcutter's hut at (1,1) (door (1,2), yard (2,1)) with a full yard and its woodcutter, trees
 * at (1,4) and (2,4), and a 2×2 Stockpile at (8,1). There's no Carrier.
 */
const woods: MapDef = {
  name: 'woods',
  rows: ['..........', '..........', '..........', '..........', '.TT.......', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 1, stock: [{ resource: 'logs', amount: FULL }] }],
  stockpiles: [{ x: 8, y: 1, w: 2, h: 2 }],
  villagers: [],
};

function only(s: GameState, type: string): EntityId {
  const id = idsOf(s.components.building).find((b) => s.components.building[b]?.type === type);
  if (id === undefined) throw new Error(`no ${type}`);
  return id;
}

function workerOf(s: GameState): EntityId {
  const id = idsOf(s.components.villager)[0];
  if (id === undefined) throw new Error('no villager');
  return id;
}

/** Units of `resource` on every Stockpile. */
function piled(s: GameState, resource: 'logs' | 'firewood'): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), resource);
  }
  return total;
}

describe('a gatherer with a full yard', () => {
  it('hauls its own output to a Stockpile, keeping its Job, then goes back to work', () => {
    const s = createInitialState(1, woods, content);
    const hut = only(s, 'woodcutters_hut');
    const hauling = runUntil(s, (st) => st.logistics.hauls[workerOf(st)] !== undefined, 100);
    const id = workerOf(hauling);
    expect(hauling.components.villager[id]?.job).toBe('woodcutter');
    expect(hauling.logistics.hauls[id]).toMatchObject({ from: hut, resource: 'logs' });
    expect(isHelpingCarry(hauling, id)).toBe(true);

    const delivered = runUntil(hauling, (st) => piled(st, 'logs') > 0, 400);
    expect(piled(delivered, 'logs')).toBe(1);
    // The yard has room again: back to the trees rather than on to another Haul.
    const working = runUntil(
      delivered,
      (st) => st.components.woodcutter[id]?.kind === 'chopping',
      400,
    );
    expect(working.components.woodcutter[id]?.kind).toBe('chopping');
    expect(working.logistics.hauls[id]).toBeUndefined();
    expect(isHelpingCarry(working, id)).toBe(false);
  });

  it('counts as a Carrier only while it holds a Haul', () => {
    const s = createInitialState(1, woods, content);
    const hauling = runUntil(s, (st) => st.logistics.hauls[workerOf(st)] !== undefined, 100);
    expect(carrierUtilization(run(hauling, 20), content)).toBe(100);
    // Hauls and chops by turns: never counted at work without a Haul.
    const later = run(hauling, 1000);
    expect(carrierUtilization(later, content)).toBe(100);
  });
});

/**
 * A chopping block at (1,1) (door (1,2), yard (2,1)) with an empty input buffer and its
 * woodsplitter, and a 2×2 Stockpile at (6,1) holding 6 logs. There's no Carrier.
 */
const block: MapDef = {
  name: 'block',
  rows: Array(6).fill('..........'),
  buildings: [{ type: 'chopping_block', x: 1, y: 1 }],
  stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods: [{ resource: 'logs', amount: 6 }] }],
  villagers: [],
};

describe('a workshop waiting for inputs', () => {
  it('lends its worker, who brings the logs and splits them', () => {
    const s = createInitialState(1, block, content);
    const chopping = only(s, 'chopping_block');
    const hauling = runUntil(s, (st) => st.logistics.hauls[workerOf(st)] !== undefined, 100);
    const id = workerOf(hauling);
    expect(hauling.components.villager[id]?.job).toBe('woodsplitter');
    expect(hauling.logistics.hauls[id]).toMatchObject({ to: chopping, resource: 'logs' });

    const splitting = runUntil(hauling, (st) => st.components.crafter[id]?.kind === 'working', 600);
    expect(splitting.components.crafter[id]?.kind).toBe('working');
    expect(isHelpingCarry(splitting, id)).toBe(false);
  });

  it('runs the same twice', () => {
    const a = run(createInitialState(1, block, content), 3000);
    const b = run(createInitialState(1, block, content), 3000);
    expect(a).toEqual(b);
    // Every log split, the firewood carried off to the Stockpile by the woodsplitter itself.
    expect(piled(a, 'logs')).toBe(0);
    expect(piled(a, 'firewood')).toBe(12);
  });
});
