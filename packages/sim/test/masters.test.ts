// Masters (spec, Trades and masters: What a master is, How a trade scales). A trade's workshops
// stand idle until its Master settles; the Master works in the first of them at +50%, the others
// work at normal speed, and once the Master is lost every one of them crawls at 25%.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { workplaceStatus } from '../src/bottlenecks';
import { killVillager } from '../src/deaths';
import { inputRoom } from '../src/logistics/supplyDemand';
import { createInitialState, type MapDef } from '../src/map';
import { masterOf, settleMaster } from '../src/masters';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { step } from '../src/step';
import { content, homelessContent } from './helpers';

/** Content whose chopping block is a Carpenter's workshop (and nobody minds being Homeless). */
const crafty: Content = {
  ...homelessContent(),
  buildings: {
    ...content.buildings,
    chopping_block: { ...content.buildings.chopping_block, trade: 'carpenter' },
  },
};

/**
 * Chopping blocks (Carpenter's workshops here) 1 at (1,1) and 3 at (5,1), each with its
 * woodsplitter (2 and 4) and 6 logs in its input buffer, and a Carrier 5 at (3,4). No Stockpile,
 * so nothing is hauled away.
 */
const shop: MapDef = {
  name: 'shop',
  rows: Array(6).fill('..........'),
  buildings: [
    { type: 'chopping_block', x: 1, y: 1 },
    { type: 'chopping_block', x: 5, y: 1 },
  ],
  villagers: [{ job: 'carrier', x: 3, y: 4 }],
};
const FIRST = 1;
const SECOND = 3;
const CARRIER = 5;
const BATCH = content.recipes.split_logs.workTicks;

function shopState(): GameState {
  const s = createInitialState(1, shop, crafty);
  for (const id of [FIRST, SECOND]) {
    const b = s.components.building[id];
    if (b) b.input.logs = 6;
  }
  return s;
}

function play(s: GameState, ticks: number): GameState {
  let x = s;
  for (let i = 0; i < ticks; i++) x = step(x, [], crafty);
  return x;
}

/** The crafter at `workshop`, by ID order. */
function crafterAt(s: GameState, workshop: EntityId): EntityId | undefined {
  const { villager } = s.components;
  return Object.keys(villager)
    .map(Number)
    .find((id) => villager[id]?.workplace === workshop);
}

/**
 * Ticks the next batch at `workshop` is set to take: runs until its crafter starts one (a
 * `working` task straight from idle) and reads how long it was given.
 */
function batchTicks(s: GameState, workshop: EntityId, c: Content = crafty): number {
  let x = s;
  for (let i = 0; i < 2000; i++) {
    const before = x.components.crafter[crafterAt(x, workshop) ?? -1]?.kind;
    x = step(x, [], c);
    const task = x.components.crafter[crafterAt(x, workshop) ?? -1];
    if (before !== 'working' && task?.kind === 'working') return task.ticksLeft;
  }
  throw new Error(`no batch started at ${workshop}`);
}

describe('a trade with no Master', () => {
  it('leaves its workshops idle, waiting for a Master, and asks for no inputs', () => {
    const s = play(shopState(), 400);
    for (const id of [FIRST, SECOND]) {
      expect(s.components.building[id]?.stock.firewood ?? 0).toBe(0);
      expect(s.components.building[id]?.input.logs).toBe(6);
      expect(workplaceStatus(s, crafty, id)).toEqual({ kind: 'noMaster', trade: 'carpenter' });
    }
    const emptied = shopState();
    const b = emptied.components.building[FIRST];
    if (b) b.input.logs = 0;
    expect(inputRoom(emptied, crafty, FIRST, 'logs')).toBe(0);
  });

  it('leaves workshops that need no Master alone', () => {
    const s = play(createInitialState(1, shop, content), 1);
    const b = s.components.building[FIRST];
    if (b) b.input.logs = 6;
    expect(batchTicks(s, FIRST, homelessContent())).toBe(BATCH);
  });
});

describe('a settled Master', () => {
  function settled(): GameState {
    const s = shopState();
    settleMaster(s, CARRIER, 'carpenter');
    return s;
  }

  it('takes a place in the first of its workshops, sending a worker there back to carrying', () => {
    const s = play(settled(), 1);
    expect(masterOf(s, CARRIER)).toBe('carpenter');
    expect(s.components.villager[CARRIER]).toMatchObject({
      workplace: FIRST,
      job: 'woodsplitter',
    });
    expect(s.components.villager[2]).toMatchObject({ workplace: null, job: 'carrier' });
    expect(s.components.villager[4]?.workplace).toBe(SECOND);
  });

  it('works 50% faster there, while the other workshop works at normal speed', () => {
    const s = play(settled(), 1);
    expect(batchTicks(s, FIRST)).toBe(Math.trunc((BATCH * 100) / 150));
    expect(batchTicks(s, SECOND)).toBe(BATCH);
    expect(workplaceStatus(s, crafty, FIRST)).toBeNull();
  });

  it('is lost when it dies: every workshop of the trade crawls at 25%', () => {
    const s = play(settled(), 1);
    killVillager(s, crafty, CARRIER, 'starvation');
    // The first workshop is staffed again by the Carrier the Master replaced.
    const restaffed = play(s, 1);
    expect(restaffed.components.villager[2]?.workplace).toBe(FIRST);
    expect(batchTicks(restaffed, FIRST)).toBe(BATCH * 4);
    expect(batchTicks(restaffed, SECOND)).toBe(BATCH * 4);
    expect(workplaceStatus(restaffed, crafty, FIRST)).toBeNull();
  });

  it('is kept by a save, and so is a trade whose Master was lost', () => {
    const s = play(settled(), 1);
    const loaded = deserialize(serialize(s), crafty);
    expect(masterOf(loaded, CARRIER)).toBe('carpenter');
    killVillager(loaded, crafty, CARRIER, 'starvation');
    const again = deserialize(serialize(loaded), crafty);
    expect(batchTicks(play(again, 1), SECOND)).toBe(BATCH * 4);
  });
});
