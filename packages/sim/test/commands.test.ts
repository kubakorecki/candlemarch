import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import { step } from '../src/step';
import { content } from './helpers';

const fresh = () => createInitialState(1, meadowMap, content);

describe('placeBuilding', () => {
  it('creates a construction site on a free tile', () => {
    const s = step(fresh(), [{ type: 'placeBuilding', building: 'hut', x: 4, y: 4 }], content);
    const sites = idsOf(s.components.site);
    expect(sites).toHaveLength(1);
    const id = sites[0] as number;
    expect(s.components.site[id]).toEqual({ type: 'hut', delivered: {}, buildProgress: 0 });
    expect(s.components.tile[id]).toEqual({ x: 4, y: 4 });
  });

  it('ignores invalid placements', () => {
    const s0 = fresh();
    const invalid = [
      { x: 13, y: 6 }, // on a tree
      { x: 9, y: 12 }, // on the woodcutter's hut
      { x: 9, y: 13 }, // on the woodcutter's hut door
      { x: 13, y: 5 }, // door would be on a tree
      { x: 0, y: 23 }, // door would be off the map
      { x: -1, y: 0 },
      { x: 2.5, y: 2 },
    ];
    for (const { x, y } of invalid) {
      expect(canPlaceBuilding(s0, content, 'hut', x, y), `${x},${y}`).toBe(false);
      const s = step(s0, [{ type: 'placeBuilding', building: 'hut', x, y }], content);
      expect(idsOf(s.components.site)).toHaveLength(0);
    }
  });

  it("won't place buildings the player can't build", () => {
    const s0 = fresh();
    expect(canPlaceBuilding(s0, content, 'woodcutters_hut', 2, 2)).toBe(false);
  });

  it("won't place a site on another site's footprint or door", () => {
    const s = step(fresh(), [{ type: 'placeBuilding', building: 'hut', x: 4, y: 4 }], content);
    expect(canPlaceBuilding(s, content, 'hut', 4, 4)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 4, 5)).toBe(false); // on its door
    expect(canPlaceBuilding(s, content, 'hut', 5, 4)).toBe(true);
  });
});

describe('cancelConstruction', () => {
  it('removes the site', () => {
    const s1 = step(fresh(), [{ type: 'placeBuilding', building: 'hut', x: 4, y: 4 }], content);
    const id = idsOf(s1.components.site)[0] as number;
    const s2 = step(s1, [{ type: 'cancelConstruction', siteId: id }], content);
    expect(idsOf(s2.components.site)).toHaveLength(0);
    expect(s2.components.tile[id]).toBeUndefined();
  });

  it('ignores ids that are not construction sites', () => {
    const s0 = fresh();
    const hut = idsOf(s0.components.building)[0] as number;
    const s = step(s0, [{ type: 'cancelConstruction', siteId: hut }], content);
    expect(s.components.building[hut]).toBeDefined();
  });
});

describe('step', () => {
  it('does not mutate its input and advances the tick', () => {
    const s0 = fresh();
    const copy = JSON.parse(JSON.stringify(s0));
    const s1 = step(s0, [{ type: 'placeBuilding', building: 'hut', x: 4, y: 4 }], content);
    expect(s0).toEqual(copy);
    expect(s1.tick).toBe(1);
  });
});
