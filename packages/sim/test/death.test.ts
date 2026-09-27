// Death: a villager starves at the Dusk its third Meal in a row is missed, and freezes at the
// Dawn after its second cold night in a row. The dead are gone: their Home frees up, their
// Workplace re-drafts, and the death is recorded.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { workersAt } from '../src/workers';
import { content, run } from './helpers';

/**
 * A woodcutter's hut at (0,0) (door (1,2)), a Hut at (7,0) (door (7,1)), a Granary at (10,0)
 * (door (11,2)) and three Carriers. The Hut has 3 places: the woodcutter and the first two
 * Carriers live there, the third is Homeless.
 * IDs: woodcutter's hut 1, woodcutter 2, Hut 3, Granary 4, Carriers 5-7.
 */
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 7 }, () => '..............'),
  buildings: [
    { type: 'woodcutters_hut', x: 0, y: 0 },
    { type: 'hut', x: 7, y: 0 },
    { type: 'granary', x: 10, y: 0 },
  ],
  villagers: [
    { job: 'carrier', x: 5, y: 4 },
    { job: 'carrier', x: 6, y: 4 },
    { job: 'carrier', x: 7, y: 4 },
  ],
};

const WORKPLACE = 1;
const WOODCUTTER = 2;
const HUT = 3;
const GRANARY = 4;
const HOMELESS_CARRIER = 7;

const WINTER_DAY = 16;

/** A copy of `s` moved on to `tick`, as if the time between had passed with nothing happening. */
function jump(s: GameState, tick: number): GameState {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  copy.tick = tick;
  return copy;
}

/** The camp, housed (one tick run), with the woodcutter's needs set as given. */
function camped(woodcutter: { missedMeals?: number; coldNights?: number }): GameState {
  const s = run(createInitialState(1, camp, content), 1);
  const v = s.components.villager[WOODCUTTER];
  if (v) Object.assign(v, woodcutter);
  return s;
}

/** `s` with `fish` in the Granary and `firewood` in the Hut. */
function supplied(s: GameState, { fish = 0, firewood = 0 }): GameState {
  const granary = s.components.building[GRANARY];
  if (granary) granary.stock = fish > 0 ? { fish } : {};
  const hut = s.components.building[HUT];
  if (hut) hut.stock = firewood > 0 ? { firewood } : {};
  return s;
}

const alive = (s: GameState, id: EntityId) => s.components.villager[id] !== undefined;

describe('starvation', () => {
  it('kills a villager at the Dusk it misses its third Meal in a row', () => {
    const s = jump(camped({ missedMeals: 2 }), duskTick(1, content));
    const name = s.components.villager[WOODCUTTER]?.name;
    const dusk = run(s, 1);
    expect(alive(dusk, WOODCUTTER)).toBe(false);
    expect(dusk.deaths).toEqual([{ name, cause: 'starvation', day: 1 }]);
    expect(dusk.components.position[WOODCUTTER]).toBeUndefined();
    // The others only missed their first.
    expect(dusk.components.villager[5]?.missedMeals).toBe(1);
  });

  it('is prevented by a Meal in time', () => {
    const s = supplied(jump(camped({ missedMeals: 2 }), duskTick(1, content)), { fish: 10 });
    const night = run(s, 400);
    expect(alive(night, WOODCUTTER)).toBe(true);
    expect(night.components.villager[WOODCUTTER]?.missedMeals).toBe(0);
    expect(night.deaths).toEqual([]);
  });
});

describe('freezing', () => {
  /** Runs the winter night after `s`'s Dusk to just after Dawn. */
  const winterNight = (s: GameState) => {
    const dusk = jump(s, duskTick(WINTER_DAY, content));
    return run(dusk, dawnTick(WINTER_DAY + 1, content) + 1 - dusk.tick);
  };

  it('kills a villager at the Dawn after its second cold night in a row', () => {
    const s = supplied(camped({ coldNights: 1 }), { fish: 10 });
    const name = s.components.villager[WOODCUTTER]?.name;
    const dawn = winterNight(s);
    expect(alive(dawn, WOODCUTTER)).toBe(false);
    expect(dawn.deaths).toEqual([{ name, cause: 'freezing', day: WINTER_DAY + 1 }]);
    // Only one cold night for the others.
    expect(dawn.components.villager[5]?.coldNights).toBe(1);
  });

  it('is prevented by a warm night in time', () => {
    const dawn = winterNight(supplied(camped({ coldNights: 1 }), { fish: 10, firewood: 5 }));
    expect(alive(dawn, WOODCUTTER)).toBe(true);
    expect(dawn.components.villager[WOODCUTTER]?.coldNights).toBe(0);
    // The Homeless Carrier spent the night in the open.
    expect(dawn.components.villager[HOMELESS_CARRIER]?.coldNights).toBe(1);
  });
});

describe('after a death', () => {
  const dead = () => run(jump(camped({ missedMeals: 2 }), duskTick(1, content)), 1);

  it('frees the Home for a Homeless villager', () => {
    expect(camped({}).components.villager[HOMELESS_CARRIER]?.home).toBeNull();
    const s = run(dead(), 1);
    expect(s.components.villager[HOMELESS_CARRIER]?.home).toBe(HUT);
  });

  it('re-drafts the Workplace from the Carriers', () => {
    const s = run(dead(), 1);
    const workers = workersAt(s, WORKPLACE);
    expect(workers).toHaveLength(1);
    expect(s.components.villager[workers[0] ?? -1]?.job).toBe('woodcutter');
  });

  it('is deterministic', () => {
    const start = () => camped({ missedMeals: 2 });
    const a = run(start(), 2 * content.calendar.dayTicks);
    const b = run(start(), 2 * content.calendar.dayTicks);
    expect(a.deaths.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
});
