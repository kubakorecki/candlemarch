// Alerts: warnings worked out from the current state (never stored) that the HUD lists. Red: a
// villager dies at the next Dusk or Dawn unless something changes. Amber: the village is heading
// for trouble.
import { describe, expect, it } from 'vitest';
import { type Alert, alerts, winterIn } from '../src/alerts';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { content, run } from './helpers';

/**
 * A Hut at (7,0) (door (7,1), 3 places), a Granary at (10,0) and four Carriers: three live in the
 * Hut, the fourth is Homeless. A Hunting ground, Old Wood, lies in the bottom-left corner.
 * IDs: Hut 1, Granary 2, Carriers 3-6.
 */
const village: MapDef = {
  name: 'village',
  rows: Array.from({ length: 7 }, () => '..............'),
  buildings: [
    { type: 'hut', x: 7, y: 0 },
    { type: 'granary', x: 10, y: 0 },
  ],
  villagers: [
    { job: 'carrier', x: 5, y: 4 },
    { job: 'carrier', x: 6, y: 4 },
    { job: 'carrier', x: 7, y: 4 },
    { job: 'carrier', x: 8, y: 4 },
  ],
  huntingGrounds: [{ name: 'Old Wood', x: 0, y: 5, w: 3, h: 2, maxGame: 20 }],
};

const HUT = 1;
const GRANARY = 2;

/** The village, housed (one tick run), moved on to `tick` with `food` fish and `firewood`. */
function villageAt(tick: number, { food = 0, firewood = 0 } = {}): GameState {
  const s = run(createInitialState(1, village, content), 1);
  s.tick = tick;
  const granary = s.components.building[GRANARY];
  if (granary) granary.stock = food > 0 ? { fish: food } : {};
  const hut = s.components.building[HUT];
  if (hut) hut.stock = firewood > 0 ? { firewood } : {};
  return s;
}

/** The alert of kind `kind`, if any. */
function alertOf<K extends Alert['kind']>(s: GameState, kind: K) {
  return alerts(s, content).find((a): a is Alert & { kind: K } => a.kind === kind);
}

const DAY_2 = dawnTick(2, content) + 100;

describe('the low Food alert', () => {
  it('shows about how many days of Meals the Granaries hold, under 3', () => {
    // Four mouths: 11 Meals is about 2 days.
    const alert = alertOf(villageAt(DAY_2, { food: 11 }), 'lowFood');
    expect(alert).toMatchObject({ severity: 'amber', days: 2 });
    expect(alert?.target).toEqual({ x: 10, y: 0 });
  });

  it('clears at 3 days of Meals', () => {
    expect(alertOf(villageAt(DAY_2, { food: 12 }), 'lowFood')).toBeUndefined();
  });
});

/** Some time into day `day`, by day. */
const dayOf = (day: number) => dawnTick(day, content) + 100;
const AUTUMN_DAY_3 = 13;

describe('the winter countdown', () => {
  it('counts the days left before winter through autumn', () => {
    expect(winterIn(villageAt(dayOf(11)), content)).toBe(5);
    expect(winterIn(villageAt(dayOf(AUTUMN_DAY_3)), content)).toBe(3);
    expect(winterIn(villageAt(dayOf(15)), content)).toBe(1);
  });

  it("isn't shown outside autumn", () => {
    expect(winterIn(villageAt(dayOf(10)), content)).toBeNull();
    expect(winterIn(villageAt(dayOf(16)), content)).toBeNull();
  });
});

describe('the winter Food alert', () => {
  it('shows in autumn when Food cannot cover the rest of autumn and winter', () => {
    // Four mouths, 3 days of autumn and 5 of winter left: 32 Meals needed.
    const alert = alertOf(villageAt(dayOf(AUTUMN_DAY_3), { food: 31 }), 'winterFood');
    expect(alert).toMatchObject({ severity: 'amber', days: 7, winterIn: 3 });
    expect(alert?.target).toEqual({ x: 10, y: 0 });
  });

  it('clears when Food covers them', () => {
    expect(alertOf(villageAt(dayOf(AUTUMN_DAY_3), { food: 32 }), 'winterFood')).toBeUndefined();
  });

  it("doesn't show outside autumn", () => {
    expect(alertOf(villageAt(dayOf(10), { food: 12 }), 'winterFood')).toBeUndefined();
    expect(alertOf(villageAt(dayOf(16), { food: 12 }), 'winterFood')).toBeUndefined();
  });
});

describe('the no firewood alert', () => {
  it('counts occupied Houses with an empty buffer in autumn and winter', () => {
    for (const day of [AUTUMN_DAY_3, 16]) {
      const alert = alertOf(villageAt(dayOf(day)), 'noFirewood');
      expect(alert).toMatchObject({ severity: 'amber', houses: 1 });
      expect(alert?.target).toEqual({ x: 7, y: 0 });
    }
  });

  it('clears with firewood in the buffer', () => {
    expect(alertOf(villageAt(dayOf(16), { firewood: 1 }), 'noFirewood')).toBeUndefined();
  });

  it("doesn't count empty Houses", () => {
    const s = villageAt(dayOf(16));
    for (const v of Object.values(s.components.villager)) v.home = null;
    expect(alertOf(s, 'noFirewood')).toBeUndefined();
  });

  it("doesn't show before autumn", () => {
    expect(alertOf(villageAt(dayOf(10)), 'noFirewood')).toBeUndefined();
  });
});

describe('the low firewood alert', () => {
  it('shows in autumn when firewood in stock is under what winter nights burn', () => {
    // One occupied House burns 1 a night for 5 winter nights; stock counts House buffers.
    const alert = alertOf(villageAt(dayOf(AUTUMN_DAY_3), { firewood: 4 }), 'lowFirewood');
    expect(alert).toMatchObject({ severity: 'amber', nights: 4, needed: 5 });
    expect(alert?.target).toEqual({ x: 7, y: 0 });
  });

  it('clears when the stock covers winter', () => {
    expect(alertOf(villageAt(dayOf(AUTUMN_DAY_3), { firewood: 5 }), 'lowFirewood')).toBeUndefined();
  });

  it("doesn't show outside autumn", () => {
    expect(alertOf(villageAt(dayOf(10)), 'lowFirewood')).toBeUndefined();
    expect(alertOf(villageAt(dayOf(16)), 'lowFirewood')).toBeUndefined();
  });
});

describe('the villager alerts', () => {
  it('count Homeless villagers', () => {
    const alert = alertOf(villageAt(DAY_2, { food: 50 }), 'homeless');
    expect(alert).toMatchObject({ severity: 'amber', villagers: 1 });
    expect(alert?.target).toEqual({ x: 8, y: 4 });
  });

  it('count Hungry and Cold villagers, and clear when nobody is', () => {
    const s = villageAt(DAY_2, { food: 50 });
    expect(alertOf(s, 'hungry')).toBeUndefined();
    expect(alertOf(s, 'cold')).toBeUndefined();
    const [a, b] = idsOf(s.components.villager).map((id) => s.components.villager[id]);
    if (a) a.missedMeals = 1;
    if (b) Object.assign(b, { missedMeals: 1, coldNights: 1 });
    expect(alertOf(s, 'hungry')).toMatchObject({ severity: 'amber', villagers: 2 });
    expect(alertOf(s, 'cold')).toMatchObject({ severity: 'amber', villagers: 1 });
  });
});

describe('the Scarce ground alert', () => {
  /** The village with Old Wood holding `game` of its 20 Game. */
  const withGame = (game: number) => {
    const s = villageAt(DAY_2, { food: 50 });
    for (const g of Object.values(s.components.huntingGround)) g.game = game;
    return s;
  };

  it('names a Hunting ground turned Scarce and points at its middle', () => {
    const alert = alertOf(withGame(4), 'scarceGround');
    expect(alert).toMatchObject({ severity: 'amber', name: 'Old Wood', health: 'scarce' });
    expect(alert?.target).toEqual({ x: 1, y: 6 });
    expect(alertOf(withGame(0), 'scarceGround')).toMatchObject({ health: 'empty' });
  });

  it('clears while the ground is only thinning', () => {
    expect(alertOf(withGame(5), 'scarceGround')).toBeUndefined();
  });
});

/** The first villager living in the Hut, and the Homeless one. */
const housed = (s: GameState) =>
  idsOf(s.components.villager).find((id) => s.components.villager[id]?.home === HUT) as EntityId;
const homeless = (s: GameState) =>
  idsOf(s.components.villager).find((id) => s.components.villager[id]?.home === null) as EntityId;

/** `s` with villager `id`'s fields set as given. */
function withVillager(s: GameState, id: EntityId, fields: object): GameState {
  const v = s.components.villager[id];
  if (v) Object.assign(v, fields);
  return s;
}

describe('the starving alert', () => {
  it('warns, first of all, that a villager two Meals down starves at Dusk without Food for all', () => {
    const s = villageAt(DAY_2, { food: 3 });
    const id = housed(s);
    withVillager(s, id, { missedMeals: 2 });
    const [first] = alerts(s, content);
    expect(first).toMatchObject({
      kind: 'willStarve',
      severity: 'red',
      villager: id,
      name: s.components.villager[id]?.name,
      at: 'dusk',
    });
    expect(first?.target).toEqual({ x: 5, y: 4 });
  });

  it('warns of Dawn for a villager still out at night', () => {
    const s = villageAt(duskTick(2, content) + 10);
    withVillager(s, housed(s), { missedMeals: 2, routine: 'toGranary' });
    expect(alertOf(s, 'willStarve')).toMatchObject({ at: 'dawn' });
  });

  it('clears with a Meal for everyone, or a Meal less missed', () => {
    const fed = villageAt(DAY_2, { food: 4 });
    expect(
      alertOf(withVillager(fed, housed(fed), { missedMeals: 2 }), 'willStarve'),
    ).toBeUndefined();
    const s = villageAt(DAY_2);
    expect(alertOf(withVillager(s, housed(s), { missedMeals: 1 }), 'willStarve')).toBeUndefined();
  });
});

describe('the freezing alert', () => {
  const WINTER_DAY = dayOf(16);

  it('warns that a villager Cold since last night freezes at Dawn in a House without firewood', () => {
    const s = villageAt(WINTER_DAY, { food: 50 });
    const id = housed(s);
    withVillager(s, id, { coldNights: 1 });
    const [first] = alerts(s, content);
    expect(first).toMatchObject({ kind: 'willFreeze', severity: 'red', villager: id });
    expect(first?.target).toEqual({ x: 5, y: 4 });
  });

  it('warns for a Homeless villager, whatever the Houses hold', () => {
    const s = villageAt(WINTER_DAY, { food: 50, firewood: 5 });
    const id = homeless(s);
    withVillager(s, id, { coldNights: 1 });
    expect(alertOf(s, 'willFreeze')).toMatchObject({ villager: id });
  });

  it('clears with firewood for tonight, or outside winter', () => {
    const warm = villageAt(WINTER_DAY, { food: 50, firewood: 1 });
    expect(
      alertOf(withVillager(warm, housed(warm), { coldNights: 1 }), 'willFreeze'),
    ).toBeUndefined();
    const spring = villageAt(dayOf(10), { food: 50 });
    expect(
      alertOf(withVillager(spring, housed(spring), { coldNights: 1 }), 'willFreeze'),
    ).toBeUndefined();
  });
});

describe('alerts over a run', () => {
  it('warn of a starving villager until Dusk, when it dies', () => {
    const s = villageAt(duskTick(2, content) - 1);
    const id = housed(s);
    withVillager(s, id, { missedMeals: 2 });
    expect(alertOf(s, 'willStarve')).toMatchObject({ villager: id });
    const dusk = run(s, 2);
    expect(dusk.components.villager[id]).toBeUndefined();
    expect(alertOf(dusk, 'willStarve')).toBeUndefined();
  });
});
