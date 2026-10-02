// Tools (spec, Economy: Tools: used and sold): a Workplace asks for one tool per worker and
// Carriers bring it; a worker holding one works 50% faster; some outputs need one (hides); a tool
// wears out after a year of days worked, and the Workplace asks for another.
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import { destroyEntity } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { amountOnTile } from '../src/stockpiles';
import { content, run, runUntil } from './helpers';

/**
 * A woodcutter's hut at (1,1) (door (1,2), yard (2,1)) and its woodcutter, six trees on row 4.
 * IDs: trees 1–6, hut 7, woodcutter 8.
 */
const woods: MapDef = {
  name: 'woods',
  rows: ['..........', '..........', '..........', '..........', '.TTTTTT...', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 1 }],
  villagers: [],
};
const HUT: EntityId = 7;
const WOODCUTTER: EntityId = 8;

/** The woods with the hut holding `tools` tools, each worked that many days. */
function woodsWith(tools: number[]): GameState {
  const s = createInitialState(1, woods, content);
  const hut = s.components.building[HUT];
  if (hut) hut.tools = tools;
  return s;
}

/** Ticks the woodcutter's first chop is given. */
function firstChop(s0: GameState): number {
  const s = runUntil(s0, (x) => x.components.woodcutter[WOODCUTTER]?.kind === 'chopping', 2000);
  const task = s.components.woodcutter[WOODCUTTER];
  if (task?.kind !== 'chopping') throw new Error('no chop');
  return task.ticksLeft;
}

describe('a worker holding a tool', () => {
  it('works 50% faster', () => {
    // A tree takes 40 ticks; with a tool trunc(40 × 100 / 150) = 26.
    expect(firstChop(woodsWith([]))).toBe(40);
    expect(firstChop(woodsWith([0]))).toBe(26);
  });
});

/**
 * A hunter's lodge 9 at (7,2) and its hunter 10 beside an 8-tree wood, the "Old Wood" Hunting
 * ground with 20 Game.
 */
const camp: MapDef = {
  name: 'camp',
  rows: ['..........', '.TTTT.....', '.TTTT.....', '..........', '..........'],
  buildings: [{ type: 'hunters_lodge', x: 7, y: 2 }],
  villagers: [],
  huntingGrounds: [{ name: 'Old Wood', x: 0, y: 0, w: 6, h: 4, maxGame: 20 }],
};
const LODGE: EntityId = 9;
const HUNTER: EntityId = 10;

/** What the hunter brings back from its first catch, the lodge holding `tools` tools. */
function firstCatch(tools: number[]) {
  const s0 = createInitialState(1, camp, content);
  const lodge = s0.components.building[LODGE];
  if (lodge) lodge.tools = tools;
  const s = runUntil(s0, (x) => (x.components.building[LODGE]?.stock.meat ?? 0) > 0, 2400);
  expect(s.components.villager[HUNTER]?.job).toBe('hunter');
  return s.components.building[LODGE]?.stock;
}

describe('a hunter', () => {
  it('brings meat and a hide with a tool', () => {
    expect(firstCatch([0])).toEqual({ meat: 4, hides: 1 });
  });

  it('brings meat and no hides without one', () => {
    expect(firstCatch([])).toEqual({ meat: 4 });
  });
});

/** Tools on every Stockpile. */
function piledTools(s: GameState): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), 'tools');
  }
  return total;
}

/** The woods plus a Stockpile 9 at (6,1) holding 2 tools, and a Carrier 10. */
const shed: MapDef = {
  ...woods,
  stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods: [{ resource: 'tools', amount: 2 }] }],
  villagers: [{ job: 'carrier', x: 5, y: 2 }],
};

describe('a Workplace', () => {
  it('asks for one tool per worker, and a Carrier brings it', () => {
    const s = run(createInitialState(1, shed, content), 300);
    expect(s.components.building[HUT]?.tools).toEqual([0]);
    expect(piledTools(s)).toBe(1);
  });
});

/**
 * `s` run through the Dusk of days `from` to `day`, a tick either side of each. There's no Granary:
 * Meals missed are forgiven so nobody starves.
 */
function dusksUntil(s: GameState, from: number, day: number): GameState {
  let x = s;
  for (let d = from; d <= day; d++) {
    for (const v of Object.values(x.components.villager)) v.missedMeals = 0;
    x = run({ ...x, tick: duskTick(d, content) - 1 }, 2);
  }
  return x;
}

describe('a tool', () => {
  it('wears out after a year of days worked (20), and the Workplace asks for another', () => {
    const s0 = run(createInitialState(1, shed, content), 300);
    expect(s0.components.building[HUT]?.tools).toEqual([0]);
    // Each Dusk the woodcutter is at work counts a day worked.
    const day19 = dusksUntil(s0, 1, 19);
    expect(day19.components.building[HUT]?.tools).toEqual([19]);
    expect(piledTools(day19)).toBe(1);
    const day20 = dusksUntil(day19, 20, 20);
    expect(day20.components.building[HUT]?.tools).toEqual([]);
    // Next morning a Carrier brings the Stockpile's last tool.
    const day21 = run({ ...day20, tick: duskTick(21, content) - 1200 }, 400);
    expect(day21.components.building[HUT]?.tools).toEqual([0]);
    expect(piledTools(day21)).toBe(0);
  });

  it("doesn't wear while its Workplace has nobody to hold it", () => {
    const s0 = woodsWith([3]);
    destroyEntity(s0, WOODCUTTER);
    expect(dusksUntil(s0, 1, 2).components.building[HUT]?.tools).toEqual([3]);
  });

  it('wears the same after save and load', () => {
    const s0 = run(createInitialState(1, shed, content), 300);
    const loaded = deserialize(serialize(s0), content);
    expect(dusksUntil(loaded, 1, 3)).toEqual(dusksUntil(s0, 1, 3));
    expect(dusksUntil(s0, 1, 3).components.building[HUT]?.tools).toEqual([3]);
  });
});
