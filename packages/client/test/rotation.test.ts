import { type BuildingId, content } from '@candlemarch/content';
import { buildingLayout, ROTATIONS } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { doorFace, doorway } from '../src/render/shapes';

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

describe('doorway', () => {
  it("puts a 1×1 hut's door mid-way along the wall facing its door tile on every turn", () => {
    const def = content.buildings.hut;
    const doorways = ROTATIONS.map((r) => doorway(buildingLayout(def, { x: 4, y: 4 }, r)));
    expect(doorways).toEqual([
      { face: 'south', sill: { x: 4.5, y: 5 }, out: { x: 0, y: 1 } },
      { face: 'west', sill: { x: 4, y: 4.5 }, out: { x: -1, y: 0 } },
      { face: 'north', sill: { x: 4.5, y: 4 }, out: { x: 0, y: -1 } },
      { face: 'east', sill: { x: 5, y: 4.5 }, out: { x: 1, y: 0 } },
    ]);
  });

  it("puts a Granary's door off-centre, in front of its door tile", () => {
    const def = content.buildings.granary;
    const doorways = ROTATIONS.map((r) => doorway(buildingLayout(def, { x: 4, y: 4 }, r)).sill);
    expect(doorways).toEqual([
      { x: 5.5, y: 6 },
      { x: 4, y: 5.5 },
      { x: 4.5, y: 4 },
      { x: 6, y: 4.5 },
    ]);
  });

  it('sits on the footprint edge between a footprint tile and the door tile, for every building and turn', () => {
    for (const type of Object.keys(content.buildings) as BuildingId[]) {
      const def = content.buildings[type];
      if (def.wall || def.groundwork) continue;
      for (const r of ROTATIONS) {
        const layout = buildingLayout(def, { x: 4, y: 4 }, r);
        const { sill, out } = doorway(layout);
        const outside = {
          x: Math.floor(sill.x + out.x * 0.5),
          y: Math.floor(sill.y + out.y * 0.5),
        };
        const inside = { x: Math.floor(sill.x - out.x * 0.5), y: Math.floor(sill.y - out.y * 0.5) };
        const { origin, size } = layout;
        expect(outside, `${type} turn ${r}`).toEqual(layout.door);
        expect(inside.x >= origin.x && inside.x < origin.x + size.w, `${type} turn ${r}`).toBe(
          true,
        );
        expect(inside.y >= origin.y && inside.y < origin.y + size.h, `${type} turn ${r}`).toBe(
          true,
        );
      }
    }
  });
});
