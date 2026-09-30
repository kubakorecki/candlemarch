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

  it('draws every building but a wall segment or groundwork differently in each rotation', () => {
    for (const type of Object.keys(content.buildings) as BuildingId[]) {
      const def = content.buildings[type];
      // A wall segment or groundwork has no door face: its door is its own tile.
      if (def.wall || def.groundwork) continue;
      const faces = ROTATIONS.map((r) => doorFace(buildingLayout(def, { x: 4, y: 4 }, r)));
      expect(new Set(faces).size, type).toBe(4);
    }
  });
});
