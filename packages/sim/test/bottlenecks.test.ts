import { describe, expect, it } from 'vitest';
import { workplaceStatus } from '../src/bottlenecks';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { content, run } from './helpers';

// A chopping block at (2,2) with its door at (2,3), and its woodsplitter.
const yard: MapDef = {
  name: 'yard',
  rows: Array(6).fill('........'),
  buildings: [{ type: 'chopping_block', x: 2, y: 2 }],
  villagers: [],
};

function blockOf(s: GameState): EntityId {
  return idsOf(s.components.building).find(
    (id) => s.components.building[id]?.type === 'chopping_block',
  ) as EntityId;
}

/** A yard with the chopping block's buffers set, run until the woodsplitter settles. */
function yardWith(logs: number, firewood: number, ticks = 60): GameState {
  const s = createInitialState(1, yard, content);
  const block = s.components.building[blockOf(s)];
  if (block) {
    block.input.logs = logs;
    block.stock.firewood = firewood;
  }
  return run(s, ticks);
}

describe('workplace status (why a Workplace stands idle)', () => {
  it('says a workshop with an empty input buffer is waiting for its input', () => {
    const s = yardWith(0, 0);
    expect(workplaceStatus(s, content, blockOf(s))).toEqual({
      kind: 'waitingFor',
      resources: ['logs'],
    });
  });

  it('says a workshop whose output buffer has no room for a batch is output full', () => {
    const s = yardWith(1, 4);
    expect(workplaceStatus(s, content, blockOf(s))).toEqual({
      kind: 'outputFull',
      resources: ['firewood'],
    });
  });

  it('says nothing while the workshop works', () => {
    const s = yardWith(2, 0, 10);
    expect(workplaceStatus(s, content, blockOf(s))).toBeNull();
  });

  it('says a Workplace with an open position has no worker', () => {
    const s = createInitialState(1, yard, content);
    const block = blockOf(s);
    for (const id of idsOf(s.components.villager)) delete s.components.villager[id];
    expect(workplaceStatus(s, content, block)).toEqual({ kind: 'noWorker' });
  });

  it('says nothing about a workshop paused at its stock target', () => {
    // 40 firewood on a stockpile meets the chopping block's target.
    const pile = createInitialState(
      1,
      { ...yard, stockpiles: [{ x: 5, y: 0, w: 1, h: 1 }] },
      content,
    );
    const pileId = idsOf(pile.components.stockpile)[0] as EntityId;
    const p = pile.components.stockpile[pileId];
    if (p) p.goods[5] = { resource: 'firewood', amount: 40 };
    const settled = run(pile, 60);
    expect(workplaceStatus(settled, content, blockOf(settled))).toBeNull();
  });
});
