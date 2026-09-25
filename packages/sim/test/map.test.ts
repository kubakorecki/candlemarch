import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { blockedGrid, tileIndex } from '../src/grid';
import { initJobDispatch } from '../src/logistics/jobDispatch';
import { relayOf } from '../src/logistics/relayState';
import { createInitialState, type MapDef } from '../src/map';
import { maps } from '../src/maps';
import { meadowMap } from '../src/maps/meadow';
import { content } from './helpers';

describe('createInitialState', () => {
  it('builds the meadow map', () => {
    const s = createInitialState(1, meadowMap, content);
    expect(s.map.width).toBe(24);
    expect(s.map.height).toBe(24);
    expect(s.tick).toBe(0);

    const trees = idsOf(s.components.mapObject);
    expect(trees).toHaveLength(17);
    for (const id of trees) expect(s.components.mapObject[id]?.amount).toBe(3);

    const buildings = idsOf(s.components.building);
    expect(buildings.map((id) => s.components.building[id]?.type)).toEqual(['woodcutters_hut']);

    const villagers = idsOf(s.components.villager).map((id) => s.components.villager[id]);
    expect(villagers.map((v) => v?.job).sort()).toEqual(['carrier', 'woodcutter']);
    const woodcutter = villagers.find((v) => v?.job === 'woodcutter');
    expect(woodcutter?.workplace).toBe(buildings[0]);
  });

  it('spawns employees on the door tile', () => {
    const s = createInitialState(1, meadowMap, content);
    const id = idsOf(s.components.woodcutter)[0] as number;
    // Hut origin (8,11), door offset (1,2) -> tile (9,13).
    expect(s.components.position[id]).toEqual({ x: 9500, y: 13500 });
  });

  it('marks trees and footprints as blocked', () => {
    const s = createInitialState(1, meadowMap, content);
    const blocked = blockedGrid(s, content);
    expect(blocked[tileIndex(s.map, 13, 6)]).toBe(1); // tree
    expect(blocked[tileIndex(s.map, 9, 12)]).toBe(1); // hut footprint
    expect(blocked[tileIndex(s.map, 9, 13)]).toBe(0); // hut door
    expect(blocked[tileIndex(s.map, 0, 0)]).toBe(0);
  });

  it('rejects malformed maps', () => {
    const base: MapDef = { name: 'bad', rows: ['...', '...'], buildings: [], villagers: [] };
    expect(() => createInitialState(1, { ...base, rows: ['...', '..'] }, content)).toThrow();
    expect(() => createInitialState(1, { ...base, rows: ['..x', '...'] }, content)).toThrow();
    expect(() =>
      createInitialState(
        1,
        { ...base, buildings: [{ type: 'woodcutters_hut', x: 2, y: 1 }] },
        content,
      ),
    ).toThrow();
  });
});

// Woodcutter's hut at (0,0) with its door (1,2) on a path along row 2 to a Flag at (6,2), next
// to a 2×2 stockpile at (7,1). A hut site at (3,1) has its door (3,2) on the path too.
const yard: MapDef = {
  name: 'yard',
  rows: ['..........', '..........', '.=====F...', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
  sites: [{ type: 'hut', x: 3, y: 1 }],
  stockpiles: [{ x: 7, y: 1, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 9, y: 3 }],
};

describe('createInitialState with roads, flags, stockpiles and sites', () => {
  it('lays paths, and places sites, then stockpiles, then free villagers', () => {
    const s = createInitialState(1, yard, content);
    expect(Object.keys(s.map.roads).map(Number)).toEqual(
      [1, 2, 3, 4, 5, 6].map((x) => tileIndex(s.map, x, 2)),
    );
    expect(Object.values(s.map.roads)).toEqual(Array(6).fill('dirt_path'));
    // IDs: woodcutter's hut 1, its woodcutter 2, site 3, stockpile 4, carrier 5.
    expect(s.components.site[3]).toEqual({ type: 'hut', delivered: {}, buildProgress: 0 });
    expect(s.components.tile[3]).toEqual({ x: 3, y: 1 });
    expect(s.components.stockpile[4]).toEqual({ size: { w: 2, h: 2 }, goods: {} });
    expect(s.components.tile[4]).toEqual({ x: 7, y: 1 });
    expect(s.components.villager[5]?.job).toBe('carrier');
  });

  it('uses job dispatch by default, which has no Flags', () => {
    const s = createInitialState(1, yard, content);
    expect(s.logistics).toEqual(initJobDispatch());
    expect(createInitialState(1, yard, content, 'jobDispatch')).toEqual(s);
  });

  it('places Flags under flag relay', () => {
    const s = createInitialState(1, yard, content, 'flagRelay');
    expect(relayOf(s)?.flags).toEqual([tileIndex(s.map, 6, 2)]);
  });

  it('rejects stockpiles, sites and Flags that could not be placed', () => {
    const onRoad = { ...yard, stockpiles: [{ x: 4, y: 2, w: 1, h: 1 }] };
    expect(() => createInitialState(1, onRoad, content)).toThrow(/stockpile/);
    const onHut = { ...yard, sites: [{ type: 'hut' as const, x: 1, y: 1 }] };
    expect(() => createInitialState(1, onHut, content)).toThrow(/site/);
    // A Flag next to the woodcutter's hut door (1,2).
    const crowded = { ...yard, rows: ['..........', '..........', '.=F===F...', '..........'] };
    expect(() => createInitialState(1, crowded, content, 'flagRelay')).toThrow(/Flag/);
  });
});

describe('maps', () => {
  it.each(Object.entries(maps))(
    '%s is listed under its name and builds under both models',
    (name, map) => {
      expect(map.name).toBe(name);
      expect(() => createInitialState(1, map, content, 'jobDispatch')).not.toThrow();
      expect(() => createInitialState(1, map, content, 'flagRelay')).not.toThrow();
    },
  );
});
