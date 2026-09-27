// The Granary: Food is hauled there, and villagers eat a Meal there at Dusk on the way home.
// A villager who finds no Food goes home Hungry and is slower until they eat.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { tileCenter } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * 12×7 with a river along row 3. A fisher's hut at (0,1) (door (0,2)), a Granary at (4,0)
 * (door (5,2)), a Hut at (9,0) (door (9,1)) and a Carrier at (7,2).
 * IDs: fisher's hut 1, fisher 2, Granary 3, Hut 4, Carrier 5.
 */
const camp: MapDef = {
  name: 'camp',
  rows: [
    '............',
    '............',
    '............',
    '~~~~~~~~~~~~',
    '............',
    '............',
    '............',
  ],
  buildings: [
    { type: 'fishers_hut', x: 0, y: 1 },
    { type: 'granary', x: 4, y: 0 },
    { type: 'hut', x: 9, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 7, y: 2 }],
};

const FISHER = 2;
const GRANARY = 3;
const CARRIER = 5;
const GRANARY_DOOR: Tile = { x: 5, y: 2 };
const HUT_DOOR: Tile = { x: 9, y: 1 };

const DUSK = duskTick(1, content);
const DAWN = dawnTick(2, content);

/** A copy of `s` moved on to `tick`, as if the time between had passed with nothing happening. */
function jump(s: GameState, tick: number): GameState {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  copy.tick = tick;
  return copy;
}

/** The camp at Dusk of day 1 with `fish` in the Granary. */
function duskWith(fish: number, map: MapDef = camp): GameState {
  const s = jump(createInitialState(1, map, content), DUSK);
  const granary = s.components.building[GRANARY];
  if (granary) granary.stock = fish > 0 ? { fish } : {};
  return s;
}

const villager = (s: GameState, id: EntityId) => s.components.villager[id];
const granaryStock = (s: GameState) => s.components.building[GRANARY]?.stock ?? {};
const asleep = (id: EntityId) => (s: GameState) => villager(s, id)?.routine === 'asleep';

describe('the Granary', () => {
  it('takes the Food Carriers bring from Workplaces', () => {
    const s = createInitialState(1, camp, content);
    const later = runUntil(s, (st) => (granaryStock(st).fish ?? 0) > 0, 1500);
    expect(granaryStock(later).fish).toBe(1);
    expect(later.components.building[1]?.stock.fish ?? 0).toBe(0);
  });

  it('takes no more Food than it has room for', () => {
    const s = createInitialState(1, camp, content);
    const capacity = content.buildings.granary.foodCapacity ?? 0;
    const granary = s.components.building[GRANARY];
    if (granary) granary.stock = { fish: capacity - 1 };
    const hut = s.components.building[1];
    if (hut) hut.stock = { fish: 3 };
    const later = run(s, 600);
    expect(granaryStock(later).fish).toBe(capacity);
    expect(later.components.building[1]?.stock.fish).toBeGreaterThanOrEqual(2);
  });
});

describe('a Meal at Dusk', () => {
  it('each villager eats 1 Food at the Granary on the way home, and the count resets', () => {
    const s = duskWith(5);
    for (const id of [FISHER, CARRIER]) {
      const v = villager(s, id);
      if (v) v.missedMeals = 2;
    }
    const walking = run(s, 1);
    expect(villager(walking, CARRIER)?.routine).toBe('toGranary');

    const home = runUntil(walking, (st) => asleep(FISHER)(st) && asleep(CARRIER)(st), 400);
    expect(granaryStock(home).fish).toBe(3);
    for (const id of [FISHER, CARRIER]) {
      expect(villager(home, id)?.missedMeals).toBe(0);
      expect(home.components.position[id]).toEqual(tileCenter(HUT_DOOR));
    }
  });

  it('eats at the Granary door, then walks home', () => {
    const s = duskWith(5);
    const ate = runUntil(s, (st) => villager(st, CARRIER)?.routine === 'goingHome', 300);
    expect(ate.components.position[CARRIER]).toEqual(tileCenter(GRANARY_DOOR));
    expect(villager(ate, CARRIER)?.missedMeals).toBe(0);
  });

  it('with no Food, villagers go home Hungry and the count grows each night', () => {
    const s = duskWith(0);
    const home = runUntil(s, (st) => asleep(FISHER)(st) && asleep(CARRIER)(st), 400);
    for (const id of [FISHER, CARRIER]) {
      expect(villager(home, id)?.missedMeals).toBe(1);
      expect(home.components.position[id]).toEqual(tileCenter(HUT_DOOR));
    }
    const nextDay = run(jump(home, DAWN), 1);
    const nextNight = run(jump(nextDay, duskTick(2, content)), 1);
    expect(villager(nextNight, CARRIER)?.missedMeals).toBe(2);
  });

  it('only the Food there is: the rest go home Hungry', () => {
    const home = run(duskWith(1), 400);
    // The Carrier, 2 tiles from the Granary door, gets there first; the fisher, 5 tiles away,
    // finds it empty.
    expect(villager(home, CARRIER)?.missedMeals).toBe(0);
    expect(villager(home, FISHER)?.missedMeals).toBe(1);
    expect(granaryStock(home).fish ?? 0).toBe(0);
  });

  it('goes to the nearest Granary that has Food', () => {
    // The camp widened, with a second Granary at (14,0) (door (15,2)). Only the far one has Food.
    const two: MapDef = {
      ...camp,
      rows: camp.rows.map((r) => `${r}.....`),
      buildings: [...camp.buildings, { type: 'granary', x: 14, y: 0 }],
    };
    // IDs: fisher's hut 1, fisher 2, Granary 3, Hut 4, Granary 5, Carrier 6.
    const s = jump(createInitialState(1, two, content), DUSK);
    const near = s.components.building[GRANARY];
    const far = s.components.building[5];
    if (near) near.stock = {};
    if (far) far.stock = { fish: 4 };
    const home = runUntil(s, (st) => asleep(2)(st) && asleep(6)(st), 600);
    expect(far && home.components.building[5]?.stock.fish).toBe(2);
    expect(villager(home, 2)?.missedMeals).toBe(0);
    expect(villager(home, 6)?.missedMeals).toBe(0);
  });

  it('eats Food in resource ID order when spoilage rates tie', () => {
    // Treat logs as Food, so the Granary holds two Foods.
    const twoFoods: Content = {
      ...content,
      resources: { ...content.resources, logs: { ...content.resources.logs, storage: 'granary' } },
    };
    const s = duskWith(0, { ...camp, villagers: [] }); // the fisher eats alone
    const granary = s.components.building[GRANARY];
    if (granary) granary.stock = { logs: 1, fish: 1 };
    const home = run(s, 400, {}, twoFoods);
    // 'fish' before 'logs'.
    expect(home.components.building[GRANARY]?.stock).toEqual({ logs: 1, fish: 0 });
  });

  it('the hero never eats', () => {
    const s = duskWith(5, { ...camp, villagers: [], hero: { x: 7, y: 1 } });
    // IDs: fisher's hut 1, fisher 2, Granary 3, Hut 4, hero 5.
    const later = run(s, 400);
    expect(granaryStock(later).fish).toBe(4); // the fisher's Meal only
  });

  it('a Villager still on the way when Dawn comes has missed the Meal', () => {
    const walking = run(duskWith(5), 1);
    expect(villager(walking, CARRIER)?.routine).toBe('toGranary');
    const dawn = run(jump(walking, DAWN), 1);
    expect(villager(dawn, CARRIER)?.routine).toBe('work');
    expect(villager(dawn, CARRIER)?.missedMeals).toBe(1);
  });
});

describe('Hungry', () => {
  it('a Hungry villager walks at half speed', () => {
    const fed = createInitialState(1, camp, content);
    const hungry = createInitialState(1, camp, content);
    const v = hungry.components.villager[CARRIER];
    if (v) v.missedMeals = 1;
    // The Carrier walks straight west along row 2 to the fisher's hut door to fetch a fish.
    const start = (s: GameState) => {
      const hut = s.components.building[1];
      if (hut) hut.stock = { fish: 1 };
      return s;
    };
    const walked = (s: GameState) =>
      7000 + 500 - (run(start(s), 12).components.position[CARRIER]?.x ?? 0);
    const fedWalk = walked(fed);
    expect(fedWalk).toBeGreaterThan(0);
    expect(walked(hungry) * content.jobs.carrier.walkSpeed).toBe(
      fedWalk * Math.trunc(content.jobs.carrier.walkSpeed / 2),
    );
  });

  it('a Hungry villager works at half speed', () => {
    const s = createInitialState(1, camp, content);
    const v = s.components.villager[FISHER];
    if (v) v.missedMeals = 1;
    const catchTicks = content.buildings.fishers_hut.fishes?.catchTicks ?? 0;
    const fishing = run(s, 1);
    const task = fishing.components.fisher[FISHER];
    expect(task?.kind === 'fishing' ? task.ticksLeft : undefined).toBe(catchTicks * 2);
  });
});

describe('a night of Meals', () => {
  const script = (): GameState => jump(duskWith(3), DUSK - 200);

  it('is deterministic', () => {
    expect(run(script(), 1800)).toEqual(run(script(), 1800));
  });

  it('saved and loaded on the way to the Granary, continues like an uninterrupted run', () => {
    const uninterrupted = run(script(), 1800);
    const walking = run(script(), 202);
    expect(villager(walking, CARRIER)?.routine).toBe('toGranary');
    expect(run(deserialize(serialize(walking), content), 1598)).toEqual(uninterrupted);
  });
});
