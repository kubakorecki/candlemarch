import type { BuildingDef, BuildingId, Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { buildingLayout, canPlaceBuilding, tileAt } from '../src/grid';
import { heroOf } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { villagerTile } from '../src/systems/movement';
import { content, run } from './helpers';

/** Footprint tiles and door of `def` at `origin`, turned `rotation` quarter turns. */
function layoutOf(def: BuildingDef, origin: { x: number; y: number }, rotation: 0 | 1 | 2 | 3) {
  const { size, tiles, door } = buildingLayout(def, origin, rotation);
  return { size, tiles, door };
}

describe('building layout', () => {
  it('turns a 2×2 building a quarter turn clockwise at a time', () => {
    // Granary: 2×2, door south of its right-hand column.
    const def = content.buildings.granary;
    const origin = { x: 5, y: 5 };
    const square = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ];
    expect(layoutOf(def, origin, 0)).toEqual({
      size: { w: 2, h: 2 },
      tiles: square,
      door: { x: 6, y: 7 },
    });
    expect(layoutOf(def, origin, 1)).toEqual({
      size: { w: 2, h: 2 },
      tiles: square,
      door: { x: 4, y: 6 },
    });
    expect(layoutOf(def, origin, 2)).toEqual({
      size: { w: 2, h: 2 },
      tiles: square,
      door: { x: 5, y: 4 },
    });
    expect(layoutOf(def, origin, 3)).toEqual({
      size: { w: 2, h: 2 },
      tiles: square,
      door: { x: 7, y: 5 },
    });
  });

  it('turns a 1×1 building: door south, west, north, east', () => {
    const def = content.buildings.hut;
    const origin = { x: 3, y: 3 };
    const doors = ([0, 1, 2, 3] as const).map((r) => layoutOf(def, origin, r));
    expect(doors.map((l) => l.door)).toEqual([
      { x: 3, y: 4 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 3 },
    ]);
    for (const l of doors) expect(l.tiles).toEqual([{ x: 3, y: 3 }]);
  });

  it('swaps width and height on a quarter turn, keeping the origin the smallest corner', () => {
    const wide: BuildingDef = {
      ...content.buildings.granary,
      size: { w: 3, h: 2 },
      door: { x: 1, y: 2 },
    };
    const origin = { x: 0, y: 0 };
    expect(layoutOf(wide, origin, 1).size).toEqual({ w: 2, h: 3 });
    expect(layoutOf(wide, origin, 1).door).toEqual({ x: -1, y: 1 });
    expect(layoutOf(wide, origin, 1).tiles).toContainEqual({ x: 1, y: 2 });
    expect(layoutOf(wide, origin, 2).size).toEqual({ w: 3, h: 2 });
    expect(layoutOf(wide, origin, 2).door).toEqual({ x: 1, y: -1 });
    expect(layoutOf(wide, origin, 3).size).toEqual({ w: 2, h: 3 });
    expect(layoutOf(wide, origin, 3).door).toEqual({ x: 2, y: 1 });
  });

  it('gives every building but a wall segment or groundwork four different layouts', () => {
    for (const type of Object.keys(content.buildings) as BuildingId[]) {
      const def = content.buildings[type];
      // A wall segment or groundwork is one tile with its door on it: turning it changes nothing.
      if (def.wall || def.groundwork) continue;
      const shapes = ([0, 1, 2, 3] as const).map((r) =>
        JSON.stringify(layoutOf(def, { x: 10, y: 10 }, r)),
      );
      expect(new Set(shapes).size, type).toBe(4);
    }
  });
});

/** 5×6 with an east–west river on row 2: north bank row 1, south bank row 3. */
const riverMap: MapDef = {
  name: 'river',
  rows: ['.....', '.....', '~~~~~', '.....', '.....', '.....'],
  buildings: [],
  villagers: [],
};

describe('placing a turned building', () => {
  it("fits a fisher's hut on the south bank with its door facing north", () => {
    const s = createInitialState(1, riverMap, content);
    // Door south (rotation 0) at row 5: not on the bank.
    expect(canPlaceBuilding(s, content, 'fishers_hut', 2, 4, 0)).toBe(false);
    // Door north (rotation 2) at row 3, the south bank.
    expect(canPlaceBuilding(s, content, 'fishers_hut', 2, 4, 2)).toBe(true);
    // The north bank still takes it unturned.
    expect(canPlaceBuilding(s, content, 'fishers_hut', 2, 0, 0)).toBe(true);
  });

  it('places a site with the rotation the command gives', () => {
    const s = createInitialState(1, riverMap, content);
    const place: Command = {
      type: 'placeBuilding',
      building: 'fishers_hut',
      x: 2,
      y: 4,
      rotation: 2,
    };
    const after = run(s, 1, { 0: [place] });
    const [id] = idsOf(after.components.site);
    expect(id).toBeDefined();
    expect(after.components.site[id as number]?.rotation).toBe(2);
  });

  it('takes an omitted rotation as 0', () => {
    const s = createInitialState(1, riverMap, content);
    const after = run(s, 1, {
      0: [{ type: 'placeBuilding', building: 'hut', x: 0, y: 4 }],
    });
    const sites = Object.values(after.components.site);
    expect(sites.map((site) => site.rotation)).toEqual([0]);
  });

  it('ignores a rotation that is not a quarter turn', () => {
    const s = createInitialState(1, riverMap, content);
    for (const rotation of [4, -1, 1.5, '1', null]) {
      const place = { type: 'placeBuilding', building: 'hut', x: 0, y: 4, rotation };
      const after = run(s, 1, { 0: [place as unknown as Command] });
      expect(Object.keys(after.components.site), String(rotation)).toEqual([]);
    }
  });
});

/** Content with the Granary stretched to a 3×1 wall, door south of its middle. */
const wallContent: Content = {
  ...content,
  buildings: {
    ...content.buildings,
    granary: { ...content.buildings.granary, size: { w: 3, h: 1 }, door: { x: 1, y: 1 } },
  },
};

/** 5×4 with that wall turned north–south on column 2, rows 0–2; the hero on the west side. */
const wallMap: MapDef = {
  name: 'wall',
  rows: ['.....', '.....', '.....', '.....'],
  buildings: [{ type: 'granary', x: 2, y: 0, rotation: 1 }],
  villagers: [],
  hero: { x: 0, y: 1 },
};

describe('a turned building on the map', () => {
  it('blocks its turned footprint, so walkers go around it', () => {
    let s = createInitialState(1, wallMap, wallContent);
    s = run(s, 1, { 0: [{ type: 'orderHero', order: 'move', x: 4, y: 1 }] }, wallContent);
    const hero = heroOf(s) as number;
    const tiles = (s.components.path[hero]?.tiles ?? []).map((i) => tileAt(s.map, i));
    expect(tiles).toContainEqual({ x: 2, y: 3 });
    for (const t of tiles) expect(t.x === 2 && t.y < 3, `${t.x},${t.y}`).toBe(false);
    s = run(s, 400, {}, wallContent);
    expect(villagerTile(s, hero)).toEqual({ x: 4, y: 1 });
  });

  it('refuses a map building that does not fit turned', () => {
    // Turned north–south from row 2, the wall runs off the map's bottom edge.
    const off = {
      ...wallMap,
      buildings: [{ type: 'granary' as const, x: 2, y: 2, rotation: 1 as const }],
    };
    expect(() => createInitialState(1, off, wallContent)).toThrow(/doesn't fit/);
  });
});

/** A hut site turned to face north, a stockpile of logs and one Carrier. */
const siteMap: MapDef = {
  name: 'turned site',
  rows: ['......', '......', '......', '......', '......', '......'],
  buildings: [],
  sites: [{ type: 'hut', x: 2, y: 3, rotation: 2 }],
  stockpiles: [{ x: 5, y: 5, w: 1, h: 1, goods: [{ resource: 'logs', amount: 4 }] }],
  villagers: [{ job: 'carrier', x: 0, y: 5 }],
};

function delivered(s: GameState): number {
  return Object.values(s.components.site)[0]?.delivered.logs ?? 0;
}

describe('a turned construction site', () => {
  it('takes deliveries at its turned door', () => {
    let s = createInitialState(1, siteMap, content);
    const carrier = idsOf(s.components.villager)[0] as number;
    let at: Tile | null = null;
    for (let i = 0; i < 1000 && delivered(s) === 0; i++) {
      s = step(s, [], content);
      if (delivered(s) > 0) at = villagerTile(s, carrier);
    }
    // Door north of (2, 3): the tile a hut facing south would never use.
    expect(at).toEqual({ x: 2, y: 2 });
  });

  it('keeps its rotation when built', () => {
    const s = createInitialState(1, siteMap, content);
    const [id] = idsOf(s.components.site) as [number];
    const site = s.components.site[id];
    if (site) site.delivered = { logs: 10 };
    const built = run(s, content.buildings.hut.construction?.buildTicks ?? 0);
    expect(built.components.building[id]?.rotation).toBe(2);
  });
});

describe('rotation in saves and replays', () => {
  const commands: Record<number, Command[]> = {
    0: [{ type: 'placeBuilding', building: 'hut', x: 0, y: 0, rotation: 3 }],
  };

  it('is deterministic', () => {
    const a = run(createInitialState(7, siteMap, content), 600, commands);
    const b = run(createInitialState(7, siteMap, content), 600, commands);
    expect(a).toEqual(b);
    expect(Object.values(a.components.site).map((site) => site.rotation)).toContain(3);
  });

  it('saves and loads turned buildings mid-run, then carries on the same', () => {
    const start = createInitialState(7, siteMap, content);
    const straight = run(start, 600, commands);
    const half = run(start, 300, commands);
    const loaded = deserialize(serialize(half), content);
    expect(run(loaded, 300, commands)).toEqual(straight);
  });

  it('loads a save made before rotation as the content layout', () => {
    const old = {
      ...siteMap,
      buildings: [{ type: 'hut' as const, x: 0, y: 0 }],
      sites: [{ type: 'hut' as const, x: 2, y: 3 }],
    };
    const s = run(createInitialState(1, old, content), 1);
    const data = JSON.parse(serialize(s));
    const { building, site } = data.components as Record<string, Record<string, object>>;
    for (const placed of [...Object.values(building ?? {}), ...Object.values(site ?? {})]) {
      delete (placed as { rotation?: number }).rotation;
    }
    expect(JSON.stringify(data)).not.toContain('rotation');
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });
});
