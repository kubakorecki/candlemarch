import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { blockedGrid, occupiedGrid, tileIndex } from '../src/grid';
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

  it('marks footprints as blocked, and trees as occupied but walked through', () => {
    const s = createInitialState(1, meadowMap, content);
    const blocked = blockedGrid(s, content);
    expect(blocked[tileIndex(s.map, 13, 6)]).toBe(0); // tree
    expect(occupiedGrid(s, content)[tileIndex(s.map, 13, 6)]).toBe(1);
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

// Woodcutter's hut at (0,0) with its door (1,2) on a path along row 2 to (6,2), next to a 2×2
// stockpile at (7,1). A hut site at (3,1) has its door (3,2) on the path too.
const yard: MapDef = {
  name: 'yard',
  rows: ['..........', '..........', '.======...', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
  sites: [{ type: 'hut', x: 3, y: 1 }],
  stockpiles: [{ x: 7, y: 1, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 9, y: 3 }],
};

describe('createInitialState with roads, stockpiles and sites', () => {
  it('lays paths, and places sites, then stockpiles, then free villagers', () => {
    const s = createInitialState(1, yard, content);
    expect(Object.keys(s.map.roads).map(Number)).toEqual(
      [1, 2, 3, 4, 5, 6].map((x) => tileIndex(s.map, x, 2)),
    );
    expect(Object.values(s.map.roads)).toEqual(Array(6).fill('dirt_path'));
    // IDs: woodcutter's hut 1, its woodcutter 2, site 3, stockpile 4, carrier 5.
    expect(s.components.site[3]).toEqual({
      type: 'hut',
      rotation: 0,
      delivered: {},
      buildProgress: 0,
    });
    expect(s.components.tile[3]).toEqual({ x: 3, y: 1 });
    expect(s.components.stockpile[4]).toEqual({
      size: { w: 2, h: 2 },
      priority: 'normal',
      refuses: [],
      goods: {},
    });
    expect(s.components.tile[4]).toEqual({ x: 7, y: 1 });
    expect(s.components.villager[5]?.job).toBe('carrier');
  });

  it('starts with no hauls', () => {
    expect(createInitialState(1, yard, content).logistics).toEqual({ hauls: {} });
  });

  it('rejects stockpiles and sites that could not be placed', () => {
    const onRoad = { ...yard, stockpiles: [{ x: 4, y: 2, w: 1, h: 1 }] };
    expect(() => createInitialState(1, onRoad, content)).toThrow(/stockpile/);
    const onHut = { ...yard, sites: [{ type: 'hut' as const, x: 1, y: 1 }] };
    expect(() => createInitialState(1, onHut, content)).toThrow(/site/);
  });

  it('keeps the entry tile, which must be walkable and on the edge', () => {
    const base: MapDef = { name: 'e', rows: ['...', '.~.', '~..'], buildings: [], villagers: [] };
    expect(createInitialState(1, base, content).map.entry).toBeNull();
    expect(createInitialState(1, { ...base, entry: { x: 2, y: 1 } }, content).map.entry).toEqual({
      x: 2,
      y: 1,
    });
    expect(() => createInitialState(1, { ...base, entry: { x: 1, y: 1 } }, content)).toThrow(
      /entry/,
    );
    expect(() => createInitialState(1, { ...base, entry: { x: 0, y: 2 } }, content)).toThrow(
      /entry/,
    );
    expect(() => createInitialState(1, { ...base, entry: { x: 3, y: 0 } }, content)).toThrow(
      /entry/,
    );
  });
});

describe('createInitialState with starting goods', () => {
  // A Granary at (0,0) (door (1,2)) and a 2×2 stockpile at (3,0).
  const camp: MapDef = {
    name: 'camp',
    rows: ['......', '......', '......'],
    buildings: [{ type: 'granary', x: 0, y: 0, stock: [{ resource: 'meat', amount: 20 }] }],
    stockpiles: [{ x: 3, y: 0, w: 2, h: 2, goods: [{ resource: 'logs', amount: 30 }] }],
    villagers: [],
  };

  it('fills building buffers and stockpile tiles, row by row up to the tile capacity', () => {
    const s = createInitialState(1, camp, content);
    expect(s.components.building[1]?.stock).toEqual({ meat: 20 });
    // Tiles hold 8: (3,0), (4,0), (3,1) are full and (4,1) takes the other 6.
    expect(s.components.stockpile[2]?.goods).toEqual({
      [tileIndex(s.map, 3, 0)]: { resource: 'logs', amount: 8 },
      [tileIndex(s.map, 4, 0)]: { resource: 'logs', amount: 8 },
      [tileIndex(s.map, 3, 1)]: { resource: 'logs', amount: 8 },
      [tileIndex(s.map, 4, 1)]: { resource: 'logs', amount: 6 },
    });
  });

  it('rejects goods that do not fit', () => {
    const tooMuch = {
      ...camp,
      stockpiles: [{ x: 3, y: 0, w: 2, h: 2, goods: [{ resource: 'logs' as const, amount: 33 }] }],
    };
    expect(() => createInitialState(1, tooMuch, content)).toThrow(/stockpile/);
    const food = {
      ...camp,
      stockpiles: [{ x: 3, y: 0, w: 1, h: 1, goods: [{ resource: 'meat' as const, amount: 1 }] }],
    };
    expect(() => createInitialState(1, food, content)).toThrow(/stockpile/);
    const logsInGranary = {
      ...camp,
      buildings: [
        { type: 'granary' as const, x: 0, y: 0, stock: [{ resource: 'logs' as const, amount: 1 }] },
      ],
    };
    expect(() => createInitialState(1, logsInGranary, content)).toThrow(/granary/);
    const overfull = {
      ...camp,
      buildings: [
        {
          type: 'granary' as const,
          x: 0,
          y: 0,
          stock: [{ resource: 'meat' as const, amount: 101 }],
        },
      ],
    };
    expect(() => createInitialState(1, overfull, content)).toThrow(/granary/);
  });
});

describe('maps', () => {
  it.each(Object.entries(maps))('%s is listed under its name and builds', (name, map) => {
    expect(map.name).toBe(name);
    expect(() => createInitialState(1, map, content)).not.toThrow();
  });

  it.each(Object.entries(maps))('%s has an entry for Newcomers', (_, map) => {
    expect(createInitialState(1, map, content).map.entry).not.toBeNull();
  });
});
