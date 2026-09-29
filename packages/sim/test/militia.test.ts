// The Militia bell: ringing it calls every villager to arms, they drop their work, walk to the bell
// and fight Gloamlings near it; ringing again or Dawn stands them down.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { isIndoors } from '../src/combat';
import type { Command } from '../src/commands';
import { canPlaceBuilding, tileCenter, tileOfPoint } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { isBellRung } from '../src/militia';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Point } from '../src/state';
import { walkTo } from '../src/systems/movement';
import { content, run, runUntil } from './helpers';

const RING: Command[] = [{ type: 'ringBell' }];

/**
 * By day: three trees at x=9 (IDs 1–3), a woodcutter's hut at (2,1) (ID 4, door (3,3)) with its
 * woodcutter (ID 5), the bell at (10,1) (ID 6, door (10,2)) and a Carrier (ID 7) at (5,5).
 */
const yard: MapDef = {
  name: 'yard',
  rows: Array.from({ length: 7 }, (_, y) =>
    y % 2 === 1 ? `${'.'.repeat(9)}T${'.'.repeat(10)}` : '.'.repeat(20),
  ),
  buildings: [
    { type: 'woodcutters_hut', x: 2, y: 1 },
    { type: 'bell', x: 10, y: 1 },
  ],
  villagers: [{ job: 'carrier', x: 5, y: 5 }],
};
const HUT = 4;
const WOODCUTTER = 5;
const CARRIER = 7;
const BELL_DOOR = { x: 10, y: 2 };

/** The yard mid-morning, the woodcutter carrying a log home from (15,3). */
function yardAtWork(): GameState {
  const s = createInitialState(1, yard, content);
  s.tick = 400;
  s.components.position[WOODCUTTER] = tileCenter({ x: 15, y: 3 });
  const v = s.components.villager[WOODCUTTER];
  if (v) v.carrying = { resource: 'logs', amount: 1 };
  s.components.woodcutter[WOODCUTTER] = { kind: 'toHut' };
  walkTo(s, content, WOODCUTTER, [{ x: 3, y: 3 }]);
  return s;
}

function tileOf(s: GameState, id: EntityId) {
  return tileOfPoint(s.components.position[id] as Point);
}

/** Runs until nobody is walking, up to `max` ticks. */
function settle(s: GameState, max = 600): GameState {
  return runUntil(s, (x) => Object.keys(x.components.path).length === 0, max);
}

describe('ringing the bell', () => {
  it('pulls every villager off work to stand at the bell', () => {
    const s = run(yardAtWork(), 1, { 400: RING });
    expect(isBellRung(s)).toBe(true);
    for (const id of [WOODCUTTER, CARRIER]) {
      expect(s.components.villager[id]?.militia).toBe(true);
    }
    // The log goes back to the hut by the unassign rule; the woodcutter keeps its Job.
    expect(s.components.villager[WOODCUTTER]).toMatchObject({
      carrying: null,
      job: 'woodcutter',
      workplace: HUT,
    });
    expect(s.components.building[HUT]?.stock.logs).toBe(1);
    const mustered = settle(s);
    expect(tileOf(mustered, WOODCUTTER)).toEqual(BELL_DOOR);
    expect(tileOf(mustered, CARRIER)).toEqual(BELL_DOOR);
    // Nobody works while it rings.
    const later = run(mustered, 400);
    expect(later.components.woodcutter[WOODCUTTER]).toEqual({ kind: 'idle', retryAt: 0 });
    expect(tileOf(later, WOODCUTTER)).toEqual(BELL_DOOR);
  });

  it('again stands them down, back to their Jobs', () => {
    const rung = settle(run(yardAtWork(), 1, { 400: RING }));
    const s = run(rung, 1, { [rung.tick]: RING });
    expect(isBellRung(s)).toBe(false);
    expect(s.components.villager[WOODCUTTER]?.militia).toBe(false);
    const working = runUntil(s, (x) => x.components.woodcutter[WOODCUTTER]?.kind !== 'idle', 400);
    expect(working.components.woodcutter[WOODCUTTER]?.kind).not.toBe('idle');
  });

  it('leaves Watchmen out: they sleep by day and stay in their towers by night', () => {
    // The bell (ID 1), a watchtower (ID 2, door (6,1)) with its Watchman (ID 3), a Carrier (ID 4).
    const s = createInitialState(
      1,
      {
        name: 'post',
        rows: Array.from({ length: 6 }, () => '..........'),
        buildings: [
          { type: 'bell', x: 2, y: 0 },
          { type: 'watchtower', x: 6, y: 0 },
        ],
        villagers: [{ job: 'carrier', x: 4, y: 4 }],
      },
      content,
    );
    const byDay = run(s, 401, { 400: RING });
    expect(byDay.components.villager[4]?.militia).toBe(true);
    expect(byDay.components.villager[3]?.militia).toBe(false);

    const dusk = duskTick(1, content);
    const onWatch = run(s, dusk + 50);
    expect(onWatch.components.villager[3]?.routine).toBe('onWatch');
    const rung = run(onWatch, 100, { [onWatch.tick]: RING });
    expect(rung.components.villager[4]?.militia).toBe(true);
    expect(rung.components.villager[3]).toMatchObject({ militia: false, routine: 'onWatch' });
    expect(tileOf(rung, 3)).toEqual({ x: 6, y: 1 });
  });

  it('does nothing without a bell', () => {
    const s = createInitialState(
      1,
      { ...yard, buildings: [yard.buildings[0] as MapDef['buildings'][0]] },
      content,
    );
    expect(isBellRung(run(s, 1, { 0: RING }))).toBe(false);
  });

  it('carries on from a save made while it rings', () => {
    const s = run(yardAtWork(), 30, { 400: RING });
    const loaded = deserialize(serialize(s), content);
    expect(run(loaded, 300)).toEqual(run(s, 300));
  });

  it('loads saves made before the bell with nobody called', () => {
    const s = createInitialState(1, yard, content);
    const old = JSON.parse(serialize(s));
    delete old.components.villager[CARRIER].militia;
    expect(deserialize(JSON.stringify(old), content).components.villager[CARRIER]?.militia).toBe(
      false,
    );
  });
});

describe('the bell', () => {
  it('is one per village', () => {
    const s = createInitialState(1, yard, content);
    expect(canPlaceBuilding(s, content, 'bell', 14, 5)).toBe(false);
    const none = createInitialState(1, { ...yard, buildings: [] }, content);
    expect(canPlaceBuilding(none, content, 'bell', 14, 5)).toBe(true);
    const site = run(none, 1, { 0: [{ type: 'placeBuilding', building: 'bell', x: 14, y: 5 }] });
    expect(canPlaceBuilding(site, content, 'bell', 6, 5)).toBe(false);
  });
});

/**
 * A Hut at (2,0) (ID 1, door (2,1)) with firewood, the bell at (6,0) (ID 2, door (6,1)) and a
 * Carrier (ID 3) living in the Hut, asleep at its door on the night after `day`.
 */
function asleepAt(day: number): GameState {
  const s = createInitialState(
    1,
    {
      name: 'hamlet',
      rows: Array.from({ length: 6 }, () => '..........'),
      buildings: [
        { type: 'hut', x: 2, y: 0, stock: [{ resource: 'firewood', amount: 3 }] },
        { type: 'bell', x: 6, y: 0 },
      ],
      villagers: [{ job: 'carrier', x: 2, y: 1 }],
    },
    content,
  );
  s.tick = duskTick(day, content);
  const v = s.components.villager[3];
  if (v) v.home = 1;
  return run(s, 100);
}

const WINTER_DAY = 16;

describe('a night at the bell', () => {
  it('leaves villagers Tired next day', () => {
    const quiet = asleepAt(1);
    expect(quiet.components.villager[3]?.routine).toBe('asleep');
    const morning = (s: GameState) => run(s, dawnTick(2, content) + 1 - s.tick);
    expect(morning(quiet).components.villager[3]?.tired).toBe(false);
    const rung = morning(run(quiet, 1, { [quiet.tick]: RING }));
    expect(rung.components.villager[3]?.tired).toBe(true);
  });

  it('is a Cold night in winter', () => {
    const quiet = asleepAt(WINTER_DAY);
    const morning = (s: GameState) => run(s, dawnTick(WINTER_DAY + 1, content) + 1 - s.tick);
    expect(morning(quiet).components.villager[3]?.coldNights).toBe(0);
    const rung = morning(run(quiet, 1, { [quiet.tick]: RING }));
    expect(rung.components.villager[3]?.coldNights).toBe(1);
  });

  it('ends at Dawn: stood down, back to work', () => {
    const quiet = asleepAt(1);
    const rung = run(quiet, 1, { [quiet.tick]: RING });
    const morning = run(rung, dawnTick(2, content) + 1 - rung.tick);
    expect(isBellRung(morning)).toBe(false);
    expect(morning.components.villager[3]).toMatchObject({ militia: false, routine: 'work' });
  });

  it('stood down by night, they go Home to sleep', () => {
    const quiet = asleepAt(1);
    const rung = settle(run(quiet, 1, { [quiet.tick]: RING }));
    expect(tileOf(rung, 3)).toEqual({ x: 6, y: 1 });
    const home = settle(run(rung, 1, { [rung.tick]: RING }));
    expect(tileOf(home, 3)).toEqual({ x: 2, y: 1 });
    expect(home.components.villager[3]?.routine).toBe('asleep');
    expect(isIndoors(home, content, 3)).toBe(true);
  });

  it('brings them out of doors while it rings', () => {
    const quiet = asleepAt(1);
    expect(isIndoors(quiet, content, 3)).toBe(true);
    const rung = run(quiet, 1, { [quiet.tick]: RING });
    expect(rung.components.villager[3]?.routine).toBe('asleep');
    expect(isIndoors(rung, content, 3)).toBe(false);
  });
});

const DEN = { x: 20, y: 4 };

/**
 * A 30×9 field at spring Dusk with a Den (ID 1) at `DEN` whose one Gloamling comes out on the first
 * tick, the bell at `bell` (ID 2) and Carriers on `villagers` (IDs 3, 4...). The Gloamling's ID
 * follows theirs.
 */
function fieldAtDusk(bell: { x: number; y: number }, villagers: { x: number; y: number }[]) {
  const s = createInitialState(
    1,
    {
      name: 'field',
      rows: Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: 30 }, (_, x) => (x === DEN.x && y === DEN.y ? 'D' : '.')).join(''),
      ),
      buildings: [{ type: 'bell', ...bell }],
      villagers: villagers.map((t) => ({ job: 'carrier' as const, ...t })),
    },
    content,
  );
  s.tick = duskTick(1, content);
  return s;
}

describe('the militia', () => {
  it('fights Gloamlings within reach of the bell, all of them hitting', () => {
    // Bell at (10,4): the Den is 10 tiles off. Two Carriers at (12,2) and (12,6).
    const start = fieldAtDusk({ x: 10, y: 4 }, [
      { x: 12, y: 2 },
      { x: 12, y: 6 },
    ]);
    const s = run(start, 1, { [start.tick]: RING });
    expect(Object.keys(s.components.gloamling)).toHaveLength(1);
    const done = runUntil(s, (x) => Object.keys(x.components.gloamling).length === 0, 800);
    expect(Object.keys(done.components.gloamling)).toEqual([]);
    expect(done.tick).toBeLessThan(s.tick + 800);
    // Both landed hits; two on one, nobody died.
    expect(done.components.villager[3]?.readyAt).toBeGreaterThan(0);
    expect(done.components.villager[4]?.readyAt).toBeGreaterThan(0);
    expect(done.deaths).toEqual([]);
  });

  it('leaves Gloamlings beyond the bell alone', () => {
    // Bell at (2,4): the Den, 18 tiles off, is out of range, and the militia out of its sight.
    const s = fieldAtDusk({ x: 2, y: 4 }, [{ x: 4, y: 4 }]);
    const later = run(s, 300, { [s.tick]: RING });
    expect(Object.keys(later.components.gloamling)).toHaveLength(1);
    expect(tileOf(later, 3)).toEqual({ x: 2, y: 5 });
  });
});
