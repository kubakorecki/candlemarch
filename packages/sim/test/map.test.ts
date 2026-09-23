import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { blockedGrid, tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
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
    expect(villagers.map((v) => v?.role).sort()).toEqual(['carrier', 'woodcutter']);
    const woodcutter = villagers.find((v) => v?.role === 'woodcutter');
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
