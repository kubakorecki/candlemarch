// Homes: every Homeless villager is given a free place in a House, automatically.
import { describe, expect, it } from 'vitest';
import { destroyEntity, idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { content, run } from './helpers';

const rows = Array.from({ length: 6 }, () => '............');

/**
 * A woodcutter's hut at (0,0) (door (1,2)) with its woodcutter, Huts at (9,0) (door (9,1)) and
 * (4,0) (door (4,1)), and `carriers` Carriers standing at (10,4). No trees, so nobody walks off.
 * IDs: woodcutter's hut 1, woodcutter 2, east Hut 3, west Hut 4, Carriers from 5.
 */
function yard(carriers: number): MapDef {
  return {
    name: 'yard',
    rows,
    buildings: [
      { type: 'woodcutters_hut', x: 0, y: 0 },
      { type: 'hut', x: 9, y: 0 },
      { type: 'hut', x: 4, y: 0 },
    ],
    villagers: Array.from({ length: carriers }, () => ({ job: 'carrier' as const, x: 10, y: 4 })),
  };
}

const EAST_HUT = 3;
const WEST_HUT = 4;
const WOODCUTTER = 2;

const homeOf = (s: GameState, id: EntityId) => s.components.villager[id]?.home;

describe('home assignment', () => {
  it('starts everyone Homeless', () => {
    const s = createInitialState(1, yard(1), content);
    for (const id of idsOf(s.components.villager)) expect(homeOf(s, id)).toBeNull();
  });

  it('houses a worker nearest its Workplace, and a Carrier nearest where it stands', () => {
    const s = run(createInitialState(1, yard(1), content), 1);
    expect(homeOf(s, WOODCUTTER)).toBe(WEST_HUT);
    expect(homeOf(s, 5)).toBe(EAST_HUT);
  });

  it('fills places in ID order: a full House sends the next villager to the next nearest', () => {
    const s = run(createInitialState(1, yard(4), content), 1);
    // A Hut holds 3.
    expect([5, 6, 7].map((id) => homeOf(s, id))).toEqual([EAST_HUT, EAST_HUT, EAST_HUT]);
    expect(homeOf(s, 8)).toBe(WEST_HUT);
  });

  it('leaves villagers Homeless when every place is taken', () => {
    const s = run(createInitialState(1, yard(6), content), 1);
    // 7 villagers, 6 places: the highest ID misses out.
    expect(homeOf(s, 10)).toBeNull();
    expect(idsOf(s.components.villager).filter((id) => homeOf(s, id) === null)).toEqual([10]);
  });

  it('never moves a housed villager, even when a nearer House is built', () => {
    const farOnly: MapDef = { ...yard(1), buildings: [{ type: 'hut', x: 0, y: 0 }] };
    // IDs: Hut 1, Carrier 2.
    const s = run(createInitialState(1, farOnly, content), 1);
    expect(homeOf(s, 2)).toBe(1);

    const placed = run(s, 1, {
      [s.tick]: [{ type: 'placeBuilding', building: 'hut', x: 10, y: 2 }],
    });
    const site = idsOf(placed.components.site)[0] as EntityId;
    const supplied = placed.components.site[site];
    if (supplied) supplied.delivered = { logs: 10 };
    const built = run(placed, 250);
    expect(built.components.building[site]?.type).toBe('hut');
    expect(homeOf(built, 2)).toBe(1);
  });

  it('makes the residents of a House that is gone Homeless, and houses them again', () => {
    const s = run(createInitialState(1, yard(1), content), 1);
    destroyEntity(s, EAST_HUT);
    const after = run(s, 1);
    // The Carrier moves to the west Hut; the woodcutter was already there.
    expect(homeOf(after, 5)).toBe(WEST_HUT);
    expect(homeOf(after, WOODCUTTER)).toBe(WEST_HUT);
  });
});
