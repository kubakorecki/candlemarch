// Demolishing a built building: it goes at once, and whatever used it lets go of it.
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import type { EntityId, GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * A woodcutter's hut at (0,0) (door (1,2)) with its woodcutter, Huts at (9,0) (door (9,1)) and
 * (4,0) (door (4,1)), and a Carrier standing at (10,4). No trees, so nobody walks off.
 * IDs: woodcutter's hut 1, woodcutter 2, east Hut 3, west Hut 4, Carrier 5.
 */
const yard: MapDef = {
  name: 'yard',
  rows: Array.from({ length: 6 }, () => '............'),
  buildings: [
    { type: 'woodcutters_hut', x: 0, y: 0 },
    { type: 'hut', x: 9, y: 0 },
    { type: 'hut', x: 4, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 10, y: 4 }],
};

const WOODCUTTERS_HUT = 1;
const WOODCUTTER = 2;
const EAST_HUT = 3;
const WEST_HUT = 4;
const CARRIER = 5;

const demolish = (id: EntityId) => ({ type: 'demolishBuilding', id }) as const;

function fresh(): GameState {
  return createInitialState(1, yard, content);
}

describe('demolishBuilding', () => {
  it('removes the building and frees its tiles', () => {
    const s = run(fresh(), 1, { 0: [demolish(WOODCUTTERS_HUT)] });
    expect(s.components.building[WOODCUTTERS_HUT]).toBeUndefined();
    expect(s.components.tile[WOODCUTTERS_HUT]).toBeUndefined();
    expect(canPlaceBuilding(s, content, 'woodcutters_hut', 0, 0)).toBe(true);
  });

  it('makes its workers Carriers', () => {
    const s = run(fresh(), 1, { 0: [demolish(WOODCUTTERS_HUT)] });
    expect(s.components.villager[WOODCUTTER]).toMatchObject({ job: 'carrier', workplace: null });
    expect(s.components.woodcutter[WOODCUTTER]).toBeUndefined();
  });

  it('makes its residents Homeless, to be housed elsewhere', () => {
    const housed = run(fresh(), 1);
    expect(housed.components.villager[CARRIER]?.home).toBe(EAST_HUT);
    const s = run(housed, 1, { 1: [demolish(EAST_HUT)] });
    expect(s.components.villager[CARRIER]?.home).toBe(WEST_HUT);
  });

  it('ends a haul picking up from it', () => {
    const s0 = fresh();
    const hut = s0.components.building[WOODCUTTERS_HUT];
    if (hut) hut.stock = { logs: 5 };
    const placed = run(s0, 1, { 0: [{ type: 'placeStockpile', x: 8, y: 4, w: 2, h: 1 }] });
    const hauling = runUntil(placed, (x) => x.logistics.hauls[CARRIER] !== undefined, 100);
    expect(hauling.logistics.hauls[CARRIER]).toMatchObject({
      from: WOODCUTTERS_HUT,
      phase: 'pickup',
    });

    const s = run(hauling, 1, { [hauling.tick]: [demolish(WOODCUTTERS_HUT)] });
    expect(s.logistics.hauls[CARRIER]).toBeUndefined();
    expect(s.components.villager[CARRIER]?.carrying).toBeNull();
  });

  it('ignores ids that are not buildings', () => {
    const s0 = run(fresh(), 1, {
      0: [
        { type: 'placeBuilding', building: 'hut', x: 6, y: 4 },
        { type: 'placeStockpile', x: 0, y: 4, w: 2, h: 1 },
      ],
    });
    const site = idsOf(s0.components.site)[0] as EntityId;
    const pile = idsOf(s0.components.stockpile)[0] as EntityId;
    const s = run(s0, 1, { 1: [demolish(site), demolish(pile), demolish(CARRIER)] });
    expect(s.components.site[site]).toBeDefined();
    expect(s.components.stockpile[pile]).toBeDefined();
    expect(s.components.villager[CARRIER]).toBeDefined();
  });
});
