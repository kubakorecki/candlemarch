// The raw gatherers (spec, World and map: Deposits): the quarry, clay pit and mine dig Deposits in
// their radius into their yard. Deposits stay on the map once dug out; clay refills each spring.
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { siteCost } from '../src/costs';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { rankLock } from '../src/ranks';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

const STONE = content.mapObjects.stone_deposit.amount;
const CLAY = content.mapObjects.clay_deposit.amount;
const YARD = content.logistics.yardCapacity;

/**
 * Rock with a stone Deposit at (1,1) (ID 1) and a quarry on the Rock at (4,1) (door (4,2), yard
 * (5,1)): ID 2, its quarryman 3. No Carrier, so the yard fills up.
 */
const quarrySite: MapDef = {
  name: 'quarry',
  rows: ['........', '.s::::..', '..::::..', '........'],
  buildings: [{ type: 'quarry', x: 4, y: 1 }],
  villagers: [],
};
const STONE_DEPOSIT = 1;
const QUARRY = 2;

/**
 * A river along the bottom, clay Deposits on its bank at (1,2) (ID 1) and (6,2) (ID 2), a clay
 * pit at (3,0) (ID 3, yard (4,0)) and its clay digger 4.
 */
const bank: MapDef = {
  name: 'bank',
  rows: ['........', '........', '.c....c.', '~~~~~~~~'],
  buildings: [{ type: 'clay_pit', x: 3, y: 0 }],
  villagers: [],
};
const CLAY_PIT = 3;

/**
 * Mountain along the top with iron Deposits on its face at (1,1) (ID 1) and the Abandoned mine at
 * (6,1) (an iron Deposit, ID 2, under the point of interest, ID 3), a mine at (3,3) (ID 4, yard
 * (4,3)) and its miner 5.
 */
const face: MapDef = {
  name: 'face',
  rows: ['^^^^^^^^^', '^i^^^^M^^', '.........', '.........', '.........', '.........'],
  buildings: [{ type: 'mine', x: 3, y: 3 }],
  villagers: [],
};
const MINE = 4;

function amount(s: GameState, id: EntityId): number | undefined {
  return s.components.mapObject[id]?.amount;
}

function yard(s: GameState, id: EntityId, resource: 'stone' | 'clay' | 'iron_ore'): number {
  return s.components.building[id]?.stock[resource] ?? 0;
}

describe('a quarry', () => {
  it('stands on Rock, where nothing else is built', () => {
    const s = createInitialState(1, quarrySite, content);
    expect(canPlaceBuilding(s, content, 'quarry', 2, 2)).toBe(true);
    expect(canPlaceBuilding(s, content, 'hut', 2, 2)).toBe(false);
  });

  it('digs stone from a Deposit in its radius until its yard is full', () => {
    const s0 = createInitialState(1, quarrySite, content);
    const s = runUntil(s0, (s) => yard(s, QUARRY, 'stone') >= YARD, 20_000);
    expect(yard(s, QUARRY, 'stone')).toBe(YARD);
    expect(amount(s, STONE_DEPOSIT)).toBe(STONE - YARD);
    // Full: it digs no more.
    const later = run(s, 1000);
    expect(yard(later, QUARRY, 'stone')).toBe(YARD);
    expect(amount(later, STONE_DEPOSIT)).toBe(STONE - YARD);
  });

  it('digs a Deposit out, and the Deposit stays on the map, empty', () => {
    const s0 = createInitialState(1, quarrySite, content);
    const deposit = s0.components.mapObject[STONE_DEPOSIT];
    if (deposit) deposit.amount = 3;
    const s = run(s0, 3000);
    expect(yard(s, QUARRY, 'stone')).toBe(3);
    expect(s.components.mapObject[STONE_DEPOSIT]).toMatchObject({
      type: 'stone_deposit',
      amount: 0,
    });
  });
});

describe('a digger mid-dig', () => {
  it('carries on from a save as if never saved', () => {
    const s0 = createInitialState(1, quarrySite, content);
    const saved = run(s0, 150); // walking to the Deposit or digging
    const a = run(saved, 600);
    expect(run(deserialize(serialize(saved), content), 600)).toEqual(a);
  });
});

describe('a clay pit', () => {
  it('digs clay from Deposits on the riverbank in its radius until its yard is full', () => {
    const s0 = createInitialState(1, bank, content);
    const s = runUntil(s0, (s) => yard(s, CLAY_PIT, 'clay') >= YARD, 20_000);
    expect(yard(s, CLAY_PIT, 'clay')).toBe(YARD);
    expect((amount(s, 1) ?? 0) + (amount(s, 2) ?? 0)).toBe(2 * CLAY - YARD);
  });
});

describe('a mine', () => {
  it('digs iron ore from Deposits on the Mountain face until its yard is full', () => {
    const s0 = createInitialState(1, face, content);
    const s = runUntil(s0, (s) => yard(s, MINE, 'iron_ore') >= YARD, 20_000);
    expect(yard(s, MINE, 'iron_ore')).toBe(YARD);
    const iron = content.mapObjects.iron_deposit.amount;
    expect((amount(s, 1) ?? 0) + (amount(s, 2) ?? 0)).toBe(2 * iron - YARD);
  });
});

describe('Deposits in spring', () => {
  /** `s` jumped to the Dawn of `day` and run through it. */
  const dawnOf = (s: GameState, day: number) => run({ ...s, tick: dawnTick(day, content) }, 1);
  const setAmount = (s: GameState, id: EntityId, n: number) => {
    const obj = s.components.mapObject[id];
    if (obj) obj.amount = n;
  };

  it('an empty clay Deposit regains a quarter of its amount at the first Dawn of spring', () => {
    const s0 = createInitialState(1, bank, content);
    setAmount(s0, 1, 0);
    const winter = dawnOf(s0, 16);
    expect(amount(winter, 1)).toBe(0);
    const spring = dawnOf(winter, 21);
    expect(amount(spring, 1)).toBe(Math.floor(CLAY / 4));
    expect(amount(dawnOf(spring, 22), 1)).toBe(Math.floor(CLAY / 4)); // only the first Dawn
  });

  it('clay refills no higher than its starting amount', () => {
    const s0 = createInitialState(1, bank, content);
    setAmount(s0, 1, CLAY - 1);
    expect(amount(dawnOf(s0, 21), 1)).toBe(CLAY);
  });

  it('stone and iron ore never come back', () => {
    const quarry = createInitialState(1, quarrySite, content);
    setAmount(quarry, STONE_DEPOSIT, 0);
    expect(amount(dawnOf(quarry, 21), STONE_DEPOSIT)).toBe(0);
    const mine = createInitialState(1, face, content);
    setAmount(mine, 1, 0);
    expect(amount(dawnOf(mine, 21), 1)).toBe(0);
  });
});

describe('placing a mine', () => {
  const MINE_COST = content.buildings.mine.construction?.cost;
  const OLD_WORKINGS = content.buildings.mine.cheaperAt?.cost;
  /** The face with nothing built, two Carriers and `logs` logs on a Stockpile, at Hamlet. */
  function hamlet(logs: number): GameState {
    const s = createInitialState(
      1,
      {
        ...face,
        buildings: [],
        stockpiles: [{ x: 0, y: 4, w: 2, h: 2, goods: [{ resource: 'logs', amount: logs }] }],
        villagers: [
          { job: 'carrier', x: 8, y: 5 },
          { job: 'carrier', x: 7, y: 5 },
        ],
      },
      content,
    );
    s.rank = 'hamlet';
    return s;
  }
  const placed = (s: GameState, x: number, y: number) =>
    run(s, 1, { [s.tick]: [{ type: 'placeBuilding', building: 'mine', x, y }] });
  const siteOf = (s: GameState) => idsOf(s.components.site)[0] ?? -1;

  it('is unlocked at Hamlet, like the clay pit; the quarry at Camp', () => {
    const camp = createInitialState(1, face, content);
    expect(rankLock(camp, content, 'mine')).toEqual({ kind: 'rank', rank: 'hamlet' });
    expect(rankLock(camp, content, 'clay_pit')).toEqual({ kind: 'rank', rank: 'hamlet' });
    expect(rankLock(camp, content, 'quarry')).toBeNull();
  });

  it('costs its full price away from the Abandoned mine', () => {
    const s = placed(hamlet(0), 2, 3);
    expect(siteCost(s, content, siteOf(s))).toEqual(MINE_COST);
  });

  it('costs less beside the Abandoned mine, and is built for that', () => {
    expect(OLD_WORKINGS).toBeDefined();
    const logs = OLD_WORKINGS?.find((c) => c.resource === 'logs')?.amount ?? 0;
    const s = placed(hamlet(logs), 5, 2); // diagonally beside the Abandoned mine at (6,1)
    expect(siteCost(s, content, siteOf(s))).toEqual(OLD_WORKINGS);
    const built = runUntil(
      s,
      (s) => Object.values(s.components.building).some((b) => b.type === 'mine'),
      5000,
    );
    expect(Object.values(built.components.building).map((b) => b.type)).toContain('mine');
  });
});
