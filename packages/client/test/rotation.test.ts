import { type BuildingId, content } from '@candlemarch/content';
import { buildingLayout, ROTATIONS } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { doorFace } from '../src/render/shapes';

describe('door face', () => {
  it('follows a quarter turn clockwise: south, west, north, east', () => {
    const def = content.buildings.woodcutters_hut;
    const faces = ROTATIONS.map((r) => doorFace(buildingLayout(def, { x: 4, y: 4 }, r)));
    expect(faces).toEqual(['south', 'west', 'north', 'east']);
  });

  it('draws every building differently in each of its four rotations', () => {
    for (const type of Object.keys(content.buildings) as BuildingId[]) {
      const def = content.buildings[type];
      const faces = ROTATIONS.map((r) => doorFace(buildingLayout(def, { x: 4, y: 4 }, r)));
      expect(new Set(faces).size, type).toBe(4);
    }
  });
});
