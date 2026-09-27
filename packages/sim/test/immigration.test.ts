// Immigration: at each Dawn (but the first) one Newcomer arrives at the map's entry tile when a
// House has a free place, the Granaries hold 5 Meals for everyone plus the Newcomer, and it isn't
// winter. It's given a Home, walks there, and starts as a Carrier.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { canPlaceBuilding, entityDoor } from '../src/grid';
import { isAtHome } from '../src/homes';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { villagerTile } from '../src/systems/movement';
import { content, run, runUntil } from './helpers';

/**
 * A Hut at (7,0) (door (7,1)), a Granary at (10,0) (door (11,2)), one Carrier, and the entry on
 * the west edge at (0,3). The Hut has 3 places, so 2 are free.
 * IDs: Hut 1, Granary 2, Carrier 3.
 */
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 7 }, () => '..............'),
  entry: { x: 0, y: 3 },
  buildings: [
    { type: 'hut', x: 7, y: 0 },
    { type: 'granary', x: 10, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 5, y: 4 }],
};

const HUT = 1;
const GRANARY = 2;
const NEWCOMER = 4;
const WINTER_DAY = 16;

/** Fish doesn't spoil, so the Granary holds exactly what a test puts there. */
const noSpoiling: Content = {
  ...content,
  resources: {
    ...content.resources,
    fish: { id: 'fish', name: 'Fish', storage: 'granary', spoilPercent: 0 },
  },
};

/** The camp (or `map`), with `fish` in the Granary, moved on to the Dawn of `day`. */
function campAt(day: number, fish: number, map: MapDef = camp): GameState {
  const s = createInitialState(1, map, content);
  const granary = s.components.building[GRANARY];
  if (granary) granary.stock = { fish };
  s.tick = dawnTick(day, content);
  return s;
}

/** Runs the Dawn `s` stands at. */
function dawn(s: GameState): GameState {
  return run(s, 1, {}, noSpoiling);
}

function villagers(s: GameState): EntityId[] {
  return idsOf(s.components.villager);
}

describe('immigration', () => {
  it('brings a Newcomer to the entry tile at Dawn, with a name and a Home', () => {
    const s = dawn(campAt(2, 10));
    expect(villagers(s)).toEqual([3, NEWCOMER]);
    const v = s.components.villager[NEWCOMER];
    expect(v?.job).toBe('carrier');
    expect(v?.workplace).toBeNull();
    expect(v?.home).toBe(HUT);
    expect(v?.name).not.toBe(s.components.villager[3]?.name);
    expect(v?.name.length).toBeGreaterThan(0);
    expect(v).toMatchObject({ carrying: null, missedMeals: 0, coldNights: 0, tired: false });
    expect(villagerTile(s, NEWCOMER)).toEqual({ x: 0, y: 3 });
  });

  it('walks the Newcomer Home, then puts it to work as a Carrier', () => {
    const s = dawn(campAt(2, 10));
    expect(s.components.villager[NEWCOMER]?.routine).toBe('goingHome');
    const home = runUntil(s, (x) => x.components.villager[NEWCOMER]?.routine === 'work', 1000);
    expect(home.components.villager[NEWCOMER]?.routine).toBe('work');
    expect(villagerTile(home, NEWCOMER)).toEqual(entityDoor(home, content, HUT));
    expect(isAtHome(home, content, NEWCOMER)).toBe(true);
  });

  it('needs 5 Meals in the Granaries for each villager and the Newcomer', () => {
    expect(villagers(dawn(campAt(2, 9)))).toEqual([3]);
    expect(villagers(dawn(campAt(2, 10)))).toEqual([3, NEWCOMER]);
  });

  it('needs a free place in a House', () => {
    const full: MapDef = {
      ...camp,
      villagers: [
        { job: 'carrier', x: 5, y: 4 },
        { job: 'carrier', x: 6, y: 4 },
        { job: 'carrier', x: 7, y: 4 },
      ],
    };
    expect(villagers(dawn(campAt(2, 100, full)))).toEqual([3, 4, 5]);
  });

  it('needs a House the entry can reach', () => {
    const walled: MapDef = {
      ...camp,
      // A river cuts the entry off from the rest of the map.
      rows: camp.rows.map((row) => `.~${row.slice(2)}`),
    };
    expect(villagers(dawn(campAt(2, 100, walled)))).toEqual([3]);
  });

  it("doesn't happen in winter", () => {
    expect(villagers(dawn(campAt(WINTER_DAY, 100)))).toEqual([3]);
    expect(villagers(dawn(campAt(WINTER_DAY - 1, 100)))).toEqual([3, NEWCOMER]);
  });

  it('keeps buildings off the entry tile', () => {
    const s = campAt(2, 0);
    expect(canPlaceBuilding(s, content, 'hut', 0, 3)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 0, 5)).toBe(true);
  });

  it("doesn't happen on a map without an entry", () => {
    const { entry: _, ...noEntry } = camp;
    expect(villagers(dawn(campAt(2, 100, noEntry)))).toEqual([3]);
  });

  it("doesn't happen at the Dawn the game starts on", () => {
    expect(villagers(dawn(campAt(1, 100)))).toEqual([3]);
  });

  it('brings at most one Newcomer a Dawn, and only at Dawn', () => {
    const s = dawn(campAt(2, 100));
    expect(villagers(s)).toHaveLength(2);
    const nextDawn = run(s, dawnTick(3, content) - s.tick, {}, noSpoiling);
    expect(villagers(nextDawn)).toHaveLength(2);
    expect(villagers(dawn(nextDawn))).toHaveLength(3);
  });

  it('is deterministic, and survives a save and load on the way Home', () => {
    const start = campAt(2, 100);
    const ticks = 200;
    const a = run(start, ticks, {}, noSpoiling);
    const b = run(start, ticks, {}, noSpoiling);
    expect(b).toEqual(a);

    const midway = run(start, 20, {}, noSpoiling);
    expect(midway.components.path[NEWCOMER]).toBeDefined();
    const loaded = deserialize(serialize(midway), noSpoiling);
    expect(run(loaded, ticks - 20, {}, noSpoiling)).toEqual(a);
  });
});
