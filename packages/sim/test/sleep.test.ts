// The daily routine: at Dusk villagers finish what they hold, walk Home and sleep; at Dawn they
// walk back to work. A short night, or one spent Homeless, leaves them Tired the next day.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { tileCenter, tileOfPoint } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { content, run, runUntil } from './helpers';

const rows = Array.from({ length: 7 }, (_, y) => (y === 5 ? '.TT...........' : '..............'));

/**
 * A woodcutter's hut at (0,0) (door (1,2)) with trees just south of it at (1,5) and (2,5), a Hut
 * at (7,0) (door (7,1)), a 2×2 stockpile at (11,4) and a Carrier at (5,4).
 * IDs: trees 1-2, woodcutter's hut 3, woodcutter 4, Hut 5, stockpile 6, Carrier 7.
 */
const village: MapDef = {
  name: 'village',
  rows,
  buildings: [
    { type: 'woodcutters_hut', x: 0, y: 0 },
    { type: 'hut', x: 7, y: 0 },
  ],
  stockpiles: [{ x: 11, y: 4, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 5, y: 4 }],
};
/** The village without its Hut. IDs: trees 1-2, woodcutter's hut 3, woodcutter 4, stockpile 5, Carrier 6. */
const camp: MapDef = { ...village, buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }] };

const TREE = 1;
const WORKPLACE = 3;
const WOODCUTTER = 4;
const CARRIER = 7;
const HUT_DOOR: Tile = { x: 7, y: 1 };

const DUSK = duskTick(1, content);
const DAWN = dawnTick(2, content);
const NIGHT = DAWN - DUSK;

/** The village with 2 logs waiting in the woodcutter's hut, so the Carrier has hauling to do. */
function fresh(map: MapDef = village): GameState {
  const s = createInitialState(1, map, content);
  const hut = s.components.building[WORKPLACE];
  if (hut) hut.stock.logs = 2;
  return s;
}

/** A copy of `s` moved on to `tick`, as if the time between had passed with nothing happening. */
function jump(s: GameState, tick: number): GameState {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  copy.tick = tick;
  return copy;
}

const villager = (s: GameState, id: EntityId) => s.components.villager[id];
const routine = (s: GameState, id: EntityId) => villager(s, id)?.routine;
const tileOf = (s: GameState, id: EntityId) =>
  tileOfPoint(s.components.position[id] ?? { x: 0, y: 0 });
const asleep = (id: EntityId) => (s: GameState) => routine(s, id) === 'asleep';
const hutLogs = (s: GameState) => s.components.building[WORKPLACE]?.stock.logs ?? 0;

function pileLogs(s: GameState): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile))
    for (const goods of Object.values(pile.goods))
      if (goods.resource === 'logs') total += goods.amount;
  return total;
}

describe('Dusk', () => {
  it('a gatherer abandons a chop in progress, walks home and sleeps there', () => {
    const chopping = runUntil(
      fresh(),
      (s) => s.components.woodcutter[WOODCUTTER]?.kind === 'chopping',
      500,
    );
    const tree = chopping.components.woodcutter[WOODCUTTER];
    if (tree?.kind !== 'chopping') throw new Error('never chopped');
    const treeLeft = chopping.components.mapObject[tree.tree]?.amount;

    const dusk = step(jump(chopping, DUSK), [], content);
    expect(dusk.components.woodcutter[WOODCUTTER]?.kind).toBe('idle');
    expect(dusk.components.mapObject[tree.tree]?.amount).toBe(treeLeft);
    expect(villager(dusk, WOODCUTTER)?.carrying).toBeNull();
    expect(routine(dusk, WOODCUTTER)).toBe('goingHome');

    const home = runUntil(dusk, asleep(WOODCUTTER), 300);
    expect(routine(home, WOODCUTTER)).toBe('asleep');
    expect(home.components.position[WOODCUTTER]).toEqual(tileCenter(HUT_DOOR));
  });

  it('a gatherer carrying goods drops them at its Workplace, even when full, then goes home', () => {
    const carrying = runUntil(fresh(), (s) => villager(s, WOODCUTTER)?.carrying != null, 500);
    const dusk = jump(carrying, DUSK);
    const hut = dusk.components.building[WORKPLACE];
    if (hut) hut.stock.logs = 4; // full

    const home = runUntil(dusk, asleep(WOODCUTTER), 400);
    expect(routine(home, WOODCUTTER)).toBe('asleep');
    expect(villager(home, WOODCUTTER)?.carrying).toBeNull();
    expect(hutLogs(home)).toBe(5);
    expect(tileOf(home, WOODCUTTER)).toEqual(HUT_DOOR);
  });

  it('a Carrier holding goods finishes delivering them, then goes home', () => {
    const holding = runUntil(fresh(), (s) => s.logistics.hauls[CARRIER]?.phase === 'dropoff', 500);
    expect(pileLogs(holding)).toBe(0);

    const home = runUntil(jump(holding, DUSK), asleep(CARRIER), 400);
    expect(routine(home, CARRIER)).toBe('asleep');
    expect(pileLogs(home)).toBe(1);
    expect(villager(home, CARRIER)?.carrying).toBeNull();
    expect(tileOf(home, CARRIER)).toEqual(HUT_DOOR);
  });

  it('a Carrier still walking to a pickup drops the Haul', () => {
    const s = fresh();
    const toPickup = runUntil(s, (st) => st.logistics.hauls[CARRIER]?.phase === 'pickup', 50);
    expect(toPickup.components.path[CARRIER]).toBeDefined();

    const dusk = step(jump(toPickup, DUSK), [], content);
    expect(dusk.logistics.hauls[CARRIER]).toBeUndefined();
    expect(routine(dusk, CARRIER)).toBe('goingHome');
    expect(hutLogs(dusk)).toBe(2);
  });

  it('starts no work or Haul all night', () => {
    const night = run(jump(fresh(), DUSK), NIGHT - 1);
    expect(night.tick).toBe(DAWN - 1);
    expect(hutLogs(night)).toBe(2);
    expect(pileLogs(night)).toBe(0);
    expect(night.components.mapObject[TREE]?.amount).toBe(content.mapObjects.tree.amount);
    expect(idsOf(night.components.villager).map((id) => routine(night, id))).toEqual([
      'asleep',
      'asleep',
    ]);
  });

  it('Homeless villagers sleep where they stand', () => {
    const s = jump(createInitialState(1, camp, content), DUSK);
    const night = run(s, 50);
    for (const id of idsOf(night.components.villager)) {
      expect(villager(night, id)?.home).toBeNull();
      expect(routine(night, id)).toBe('asleep');
      expect(night.components.position[id]).toEqual(s.components.position[id]);
    }
  });
});

describe('Dawn', () => {
  it('villagers walk back to work', () => {
    const dawn = run(jump(fresh(), DUSK), NIGHT + 1);
    expect(dawn.tick).toBe(DAWN + 1);
    expect(routine(dawn, WOODCUTTER)).toBe('work');
    expect(routine(dawn, CARRIER)).toBe('work');
    expect(dawn.components.woodcutter[WOODCUTTER]?.kind).toBe('toTree');
    expect(dawn.logistics.hauls[CARRIER]).toBeDefined();
  });

  it("a villager who hasn't reached home by Dawn turns back to work", () => {
    const walking = run(jump(fresh(), DUSK), 5);
    expect(routine(walking, WOODCUTTER)).toBe('goingHome');

    const dawn = run(jump(walking, DAWN - 1), 2);
    expect(routine(dawn, WOODCUTTER)).toBe('work');
    const later = runUntil(
      dawn,
      (s) => s.components.woodcutter[WOODCUTTER]?.kind === 'chopping',
      200,
    );
    expect(later.components.woodcutter[WOODCUTTER]?.kind).toBe('chopping');
    expect(tileOf(later, WOODCUTTER).x).toBeLessThan(HUT_DOOR.x);
    // It never slept at Home.
    expect(villager(later, WOODCUTTER)?.tired).toBe(true);
  });
});

describe('the hero', () => {
  it('ignores night', () => {
    const s = jump(createInitialState(1, { ...village, hero: { x: 13, y: 6 } }, content), DUSK);
    const hero = idsOf(s.components.hero)[0] as EntityId;
    const walked = run(s, 200, { [DUSK]: [{ type: 'orderHero', order: 'move', x: 9, y: 6 }] });
    expect(tileOf(walked, hero)).toEqual({ x: 9, y: 6 });
  });
});

describe('Tired', () => {
  it('a full night at Home leaves a villager rested', () => {
    // A state at tick DAWN hasn't run Dawn yet; one more tick does.
    const dawn = run(jump(fresh(), DUSK), NIGHT + 1);
    expect(villager(dawn, WOODCUTTER)?.tired).toBe(false);
    expect(villager(dawn, CARRIER)?.tired).toBe(false);
  });

  it('under half a night asleep at Home makes a villager Tired until the next Dusk', () => {
    const home = runUntil(jump(fresh(), DUSK), asleep(WOODCUTTER), 300);
    // It got home late: 1 tick short of half the night left.
    const late = jump(home, DAWN - NIGHT / 2 + 1);
    const dawn = run(late, NIGHT / 2);
    expect(dawn.tick).toBe(DAWN + 1);
    expect(villager(dawn, WOODCUTTER)?.tired).toBe(true);

    const beforeDusk = run(jump(dawn, duskTick(2, content) - 1), 1);
    expect(villager(beforeDusk, WOODCUTTER)?.tired).toBe(true);
    const dusk = run(beforeDusk, 1);
    expect(villager(dusk, WOODCUTTER)?.tired).toBe(false);

    // Half the night exactly is enough.
    const halfNight = run(jump(home, DAWN - NIGHT / 2), NIGHT / 2 + 1);
    expect(villager(halfNight, WOODCUTTER)?.tired).toBe(false);
  });

  it('sleeping Homeless makes a villager Tired, and a full night at Home clears it', () => {
    const s = jump(createInitialState(1, camp, content), DUSK);
    const dawn = run(s, NIGHT + 1);
    for (const id of idsOf(dawn.components.villager)) expect(villager(dawn, id)?.tired).toBe(true);

    // A Hut is ready for the next night.
    const housed = run(dawn, 1, {
      [DAWN + 1]: [{ type: 'placeBuilding', building: 'hut', x: 7, y: 0 }],
    });
    const site = idsOf(housed.components.site)[0] as EntityId;
    const supplied = housed.components.site[site];
    if (supplied) supplied.delivered = { logs: 10 };
    const nextDawn = dawnTick(3, content);
    const rested = run(
      jump(run(housed, 300), duskTick(2, content)),
      nextDawn - duskTick(2, content) + 1,
    );
    expect(rested.tick).toBe(nextDawn + 1);
    for (const id of idsOf(rested.components.villager)) {
      expect(villager(rested, id)?.home).toBe(site);
      expect(villager(rested, id)?.tired).toBe(false);
    }
  });

  it('a Tired villager walks at half speed', () => {
    const rested = fresh();
    const tired = fresh();
    const v = tired.components.villager[WOODCUTTER];
    if (v) v.tired = true;
    const start = rested.components.position[WOODCUTTER]?.y ?? 0;
    // The woodcutter walks straight south towards the trees.
    const walked = (s: GameState) => (run(s, 12).components.position[WOODCUTTER]?.y ?? 0) - start;
    const restedWalk = walked(rested);
    expect(restedWalk).toBeGreaterThan(0);
    expect(walked(tired) * content.jobs.woodcutter.walkSpeed).toBe(
      restedWalk * Math.trunc(content.jobs.woodcutter.walkSpeed / 2),
    );
  });

  it("a Tired villager works at half speed, and the hero's aura multiplies on top", () => {
    const gather = content.mapObjects.tree.gatherTicks;
    const chopTicks = (s: GameState) => {
      const at = runUntil(
        s,
        (st) => st.components.woodcutter[WOODCUTTER]?.kind === 'chopping',
        200,
      );
      const task = at.components.woodcutter[WOODCUTTER];
      return task?.kind === 'chopping' ? task.ticksLeft : undefined;
    };
    const tiredIn = (map: MapDef) => {
      const s = fresh(map);
      const v = s.components.villager[WOODCUTTER];
      if (v) v.tired = true;
      return s;
    };
    expect(chopTicks(fresh())).toBe(gather);
    expect(chopTicks(tiredIn(village))).toBe(gather * 2);
    // 50% × 125% = 62%, so the chop takes 100/62 as long, truncated.
    const withHero = { ...village, hero: { x: 3, y: 3 } };
    expect(chopTicks(tiredIn(withHero))).toBe(Math.trunc((gather * 100) / 62));
  });
});

describe('a night', () => {
  const script = (): GameState => jump(fresh(), DUSK - 200);

  it('is deterministic', () => {
    expect(run(script(), 1800)).toEqual(run(script(), 1800));
  });

  it('saved and loaded mid-night, continues like an uninterrupted run', () => {
    const uninterrupted = run(script(), 1800);
    const midnight = run(script(), 800);
    expect(routine(midnight, WOODCUTTER)).toBe('asleep');
    expect(run(deserialize(serialize(midnight), content), 1000)).toEqual(uninterrupted);
  });
});
