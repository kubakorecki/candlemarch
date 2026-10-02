// Happiness (spec, Villagers: Happiness in M5): a score per villager from 0 to 100, starting at
// 50, plus its sources: Homeless −30, −10 for each death in the village in the last 3 days.
// Happy (70+) works 20% faster, Unhappy (below 30) 20% slower. Unhappy 5 Dawns in a row, a
// villager leaves at that Dawn and walks out of the entry, except in winter. No Newcomer comes
// while the villagers' average is Unhappy.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { killVillager } from '../src/deaths';
import { idsOf } from '../src/entities';
import { happiness, happinessBand, happinessSources } from '../src/happiness';
import { createInitialState, type MapDef } from '../src/map';
import { hasMaster, settleMaster } from '../src/masters';
import { deserialize, serialize } from '../src/save';
import { speedPercent } from '../src/speed';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { villagerTile } from '../src/systems/movement';
import { content, run, runUntil } from './helpers';

/**
 * No House: everyone is Homeless. A woodcutter's hut at (4,0) with its woodcutter, a Carrier, a
 * Granary of fish, and the entry on the west edge at (0,3).
 * IDs: Granary 1, woodcutter's hut 2, woodcutter 3, Carrier 4.
 */
const field: MapDef = {
  name: 'field',
  rows: Array.from({ length: 7 }, () => '..............'),
  entry: { x: 0, y: 3 },
  buildings: [
    { type: 'granary', x: 10, y: 0, stock: [{ resource: 'fish', amount: 40 }] },
    { type: 'woodcutters_hut', x: 4, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 7, y: 4 }],
};

/** The same, with a Hut at (7,0) (door (7,1)): both are housed. Hut 4, Carrier 5. */
const housed: MapDef = {
  ...field,
  buildings: [...(field.buildings ?? []), { type: 'hut', x: 7, y: 0 }],
};

const HUT_OF_FIELD = 2;
const WOODCUTTER = 3;
const CARRIER = 4;
const WINTER_DAY = 16;

/** A test Content where every villager starts at `start`. */
function startingAt(start: number): Content {
  return { ...content, happiness: { ...content.happiness, start } };
}

/** `s` moved on to the Dawn of `day` and run one tick, everyone fed, warm and asleep overnight. */
function dawnOf(s: GameState, day: number, c: Content = content): GameState {
  const next: GameState = JSON.parse(JSON.stringify(s));
  next.tick = dawnTick(day, c);
  for (const v of Object.values(next.components.villager)) {
    if (v.routine !== 'leaving') v.routine = 'asleep';
    v.missedMeals = 0;
    v.coldNights = 0;
  }
  return run(next, 1, {}, c);
}

/** Runs the Dawns of `from` to `to`. */
function dawns(s: GameState, from: number, to: number, c: Content = content): GameState {
  let next = s;
  for (let day = from; day <= to; day++) next = dawnOf(next, day, c);
  return next;
}

describe('the happiness score', () => {
  it('starts at 50 for a housed villager, with no sources', () => {
    const s = run(createInitialState(1, housed, content), 1);
    expect(s.components.villager[5]?.home).toBe(4);
    expect(happinessSources(s, content, 5)).toEqual([]);
    expect(happiness(s, content, 5)).toBe(50);
    expect(happinessBand(content, 50)).toBe('content');
  });

  it('is 30 lower while Homeless', () => {
    const s = createInitialState(1, field, content);
    expect(happinessSources(s, content, CARRIER)).toEqual([{ kind: 'homeless', value: -30 }]);
    expect(happiness(s, content, CARRIER)).toBe(20);
    expect(happinessBand(content, 20)).toBe('unhappy');
  });

  it('is 10 lower for each death in the village on the last 3 days', () => {
    let s = run(createInitialState(1, housed, content), 1);
    s.tick = dawnTick(4, content);
    killVillager(s, content, 3, 'starvation');
    expect(happinessSources(s, content, 5)).toEqual([{ kind: 'deaths', deaths: 1, value: -10 }]);
    expect(happiness(s, content, 5)).toBe(40);
    s = dawnOf(s, 6);
    expect(happiness(s, content, 5)).toBe(40);
    s = dawnOf(s, 7);
    expect(happinessSources(s, content, 5)).toEqual([]);
    expect(happiness(s, content, 5)).toBe(50);
  });

  it('stays between 0 and 100', () => {
    const s = createInitialState(1, field, startingAt(10));
    expect(happiness(s, startingAt(10), CARRIER)).toBe(0);
    expect(happiness(s, startingAt(140), CARRIER)).toBe(100);
  });
});

describe('happiness and work speed', () => {
  it('works 20% slower while Unhappy and 20% faster while Happy, on top of the worst slowdown', () => {
    const s = createInitialState(1, field, content);
    expect(speedPercent(s, content, WOODCUTTER, HUT_OF_FIELD)).toBe(80);
    const happy = startingAt(100);
    expect(speedPercent(s, happy, WOODCUTTER, HUT_OF_FIELD)).toBe(120);
    const v = s.components.villager[WOODCUTTER];
    if (v) v.tired = true;
    expect(speedPercent(s, happy, WOODCUTTER, HUT_OF_FIELD)).toBe(60);
    expect(speedPercent(s, content, WOODCUTTER, HUT_OF_FIELD)).toBe(40);
  });

  it("doesn't change walking speed", () => {
    const s = createInitialState(1, field, content);
    expect(speedPercent(s, content, WOODCUTTER)).toBe(100);
  });
});

describe('leaving the village', () => {
  it('leaves at the 5th Unhappy Dawn in a row, walking out of the entry', () => {
    let s = dawns(createInitialState(1, field, content), 2, 5);
    expect(s.components.villager[CARRIER]?.unhappyDawns).toBe(4);
    expect(s.components.villager[CARRIER]?.routine).toBe('work');
    s = dawnOf(s, 6);
    const v = s.components.villager[CARRIER];
    expect(v?.routine).toBe('leaving');
    expect(v?.job).toBe('carrier');
    expect(v?.home).toBeNull();
    const woodcutter = s.components.villager[WOODCUTTER];
    expect(woodcutter?.routine).toBe('leaving');
    expect(woodcutter?.workplace).toBeNull();
    s = runUntil(s, (x) => idsOf(x.components.villager).length === 0, 2000);
    expect(idsOf(s.components.villager)).toEqual([]);
    expect(s.departures.map((d) => d.day)).toEqual([6, 6]);
    expect(s.gameOver).toEqual({ day: 6, cause: 'left' });
  });

  it('walks to the entry before it is gone', () => {
    let s = dawns(createInitialState(1, field, content), 2, 6);
    const tiles: string[] = [];
    while (s.components.villager[CARRIER]) {
      const at = villagerTile(s, CARRIER);
      if (at) tiles.push(`${at.x},${at.y}`);
      s = step(s, [], content);
    }
    expect(tiles.at(-1)).toBe('0,3');
    expect(s.departures).toContainEqual({
      name: expect.any(String),
      trade: null,
      day: 6,
    });
  });

  it('starts counting again after a Dawn that was not Unhappy', () => {
    let s = dawns(createInitialState(1, field, content), 2, 5);
    s = dawnOf(s, 6, startingAt(80));
    expect(s.components.villager[CARRIER]?.unhappyDawns).toBe(0);
    s = dawns(s, 7, 10);
    expect(s.components.villager[CARRIER]?.routine).toBe('work');
  });

  it("doesn't leave in winter; it leaves at the first Dawn after", () => {
    let s = dawns(createInitialState(1, field, content), WINTER_DAY, WINTER_DAY + 4);
    expect(s.components.villager[CARRIER]?.unhappyDawns).toBe(5);
    expect(s.components.villager[CARRIER]?.routine).toBe('work');
    s = dawnOf(s, WINTER_DAY + 5);
    expect(s.components.villager[CARRIER]?.routine).toBe('leaving');
  });

  it('loses the Master: the trade crawls and its Charter may come again', () => {
    let s = createInitialState(1, field, content);
    settleMaster(s, CARRIER, 'carpenter');
    s = dawns(s, 2, 6);
    expect(hasMaster(s, 'carpenter')).toBe(false);
    expect(s.trades).toEqual(['carpenter']);
    s = runUntil(s, (x) => !x.components.villager[CARRIER], 2000);
    expect(s.departures.find((d) => d.trade === 'carpenter')).toBeDefined();
  });

  it('carries on the same after a save and load', () => {
    const left = dawns(createInitialState(1, field, content), 2, 6);
    const a = run(left, 200);
    const b = run(deserialize(serialize(left), content), 200);
    expect(b).toEqual(a);
  });
});

describe('immigration and happiness', () => {
  /** The housed field at day 3's Dawn with `deaths` deaths that day: the Hut has a place free. */
  function withDeaths(deaths: number): GameState {
    const s = run(createInitialState(1, housed, content), 1);
    s.tick = dawnTick(3, content);
    for (let i = 0; i < deaths; i++) s.deaths.push({ name: 'Ada', cause: 'starvation', day: 3 });
    return s;
  }

  it('brings no Newcomer while the average is Unhappy', () => {
    const s = run(withDeaths(3), 1);
    expect(idsOf(s.components.villager)).toEqual([3, 5]);
  });

  it('brings one once the average is Content', () => {
    const s = run(withDeaths(2), 1);
    expect(idsOf(s.components.villager)).toEqual([3, 5, 6]);
  });
});
