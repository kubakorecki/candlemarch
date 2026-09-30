import type { TerrainId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import { canPlaceBuilding, tileIndex } from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { mapChanged } from '../src/mapCache';
import { canLayPath } from '../src/roads';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { canPlaceStockpile } from '../src/stockpiles';
import { movementSystem, walkTo } from '../src/systems/movement';
import { content } from './helpers';

/** Each terrain's map character. */
const CHARS: Record<TerrainId, string> = {
  meadow: '.',
  rock: ':',
  mountain: '^',
  swamp: ',',
  river: '~',
  ford: '_',
  pass_snow: '*',
};

/**
 * 12×3: a band of `terrain` over columns 1–10 of every row, Meadow in columns 0 and 11, a
 * Carrier (ID 1) at (0,1).
 */
function band(terrain: TerrainId): MapDef {
  const row = `.${CHARS[terrain].repeat(10)}.`;
  return {
    name: `band of ${terrain}`,
    rows: [row, row, row],
    buildings: [],
    villagers: [{ job: 'carrier', x: 0, y: 1 }],
  };
}

/** Moves only the walkers until walker `id` arrives; the ticks it took. */
function walk(s: GameState, id: number): number {
  let ticks = 0;
  while (s.components.path[id]) {
    movementSystem(s, content);
    ticks += 1;
  }
  return ticks;
}

/** Ticks for the Carrier to walk from (0,1) to (10,1) across a band of `terrain`. */
function crossing(terrain: TerrainId): number {
  const s = createInitialState(1, band(terrain), content);
  expect(walkTo(s, content, 1, [{ x: 10, y: 1 }])).toBe(true);
  return walk(s, 1);
}

describe('terrain', () => {
  it('is drawn in map rows, one character each', () => {
    const s = createInitialState(
      1,
      { ...band('meadow'), rows: ['.:^,~_*'], villagers: [] },
      content,
    );
    expect(s.map.terrain).toEqual([
      'meadow',
      'rock',
      'mountain',
      'swamp',
      'river',
      'ford',
      'pass_snow',
    ]);
    for (const [terrain, char] of Object.entries(CHARS)) {
      const one = createInitialState(
        1,
        { ...band('meadow'), rows: [`.${char}`], villagers: [] },
        content,
      );
      expect(one.map.terrain[1]).toBe(terrain);
    }
  });

  it('can be walked on Meadow, Rock, Swamp and Fords, and nowhere else', () => {
    const walkable = (Object.keys(CHARS) as TerrainId[]).filter((t) => {
      const s = createInitialState(1, band(t), content);
      return walkTo(s, content, 1, [{ x: 11, y: 1 }]);
    });
    expect(walkable).toEqual(['meadow', 'rock', 'swamp', 'ford']);
  });

  it('can be built on only on Meadow: buildings, Stockpiles and paths', () => {
    const buildable = (Object.keys(CHARS) as TerrainId[]).filter((t) => {
      const s = createInitialState(1, band(t), content);
      const hut = canPlaceBuilding(s, content, 'hut', 5, 0);
      const pile = canPlaceStockpile(s, content, 5, 1, 1, 1);
      const path = canLayPath(s, content, { x: 3, y: 2 }, { x: 7, y: 2 });
      expect(pile, t).toBe(hut);
      expect(path, t).toBe(hut);
      return hut;
    });
    expect(buildable).toEqual(['meadow']);
  });

  it('slows walking: Rock to 80%, Swamp and Fords to 50%', () => {
    // 10 tiles of 1000 units at 75 units a tick on Meadow; 60 on Rock; 37 on Swamp and Fords.
    expect(crossing('meadow')).toBe(134);
    expect(crossing('rock')).toBe(167);
    expect(crossing('swamp')).toBe(271);
    expect(crossing('ford')).toBe(271);
  });

  it('is walked round when a slow patch costs more than the way round', () => {
    // Straight along row 1 is 5 Swamp tiles; round by row 0 is two diagonals and 4 Meadow tiles.
    const s = createInitialState(
      1,
      { ...band('meadow'), rows: ['.......', '.,,,,,.', '.......'] },
      content,
    );
    expect(walkTo(s, content, 1, [{ x: 6, y: 1 }])).toBe(true);
    const tiles = s.components.path[1]?.tiles ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    for (const i of tiles) expect(s.map.terrain[i]).toBe('meadow');
  });

  it("walks a Road on a slow tile at the Road's speed, not the terrain's", () => {
    const onMeadow = createInitialState(1, band('meadow'), content);
    const paved = step(
      onMeadow,
      [{ type: 'layPath', from: { x: 0, y: 1 }, to: { x: 11, y: 1 } }],
      content,
    );
    expect(walkTo(paved, content, 1, [{ x: 10, y: 1 }])).toBe(true);
    const meadowTicks = walk(paved, 1);

    // No path can be laid on Swamp; a Road written onto it (as a Pass road will be) still counts.
    const swamp = createInitialState(1, band('swamp'), content);
    for (let x = 1; x <= 10; x++) swamp.map.roads[tileIndex(swamp.map, x, 1)] = 'dirt_path';
    mapChanged(swamp);
    expect(walkTo(swamp, content, 1, [{ x: 10, y: 1 }])).toBe(true);
    expect(walk(swamp, 1)).toBe(meadowTicks);
    expect(meadowTicks).toBeLessThan(crossing('meadow'));
  });

  it('lets Gloamlings wade a Ford, and nothing else across the river', () => {
    // A river down column 6 with a Ford at (6,4); a Den west of it. Its Gloamling comes out at
    // the first Dusk tick.
    const rows = [
      '......~......',
      '......~......',
      '..D...~......',
      '......~......',
      '......_......',
    ];
    const map: MapDef = { name: 'ford', rows, buildings: [], villagers: [] };
    const dusk = createInitialState(1, map, content);
    dusk.tick = duskTick(1, content);
    const s = step(dusk, [], content);
    const gloamling = Number(Object.keys(s.components.gloamling)[0]);
    expect(s.components.gloamling[gloamling]).toBeDefined();
    delete s.components.path[gloamling];
    expect(walkTo(s, content, gloamling, [{ x: 10, y: 2 }])).toBe(true);
    expect(s.components.path[gloamling]?.tiles).toContain(tileIndex(s.map, 6, 4));
    walk(s, gloamling);
    expect(s.components.position[gloamling]).toEqual({ x: 10_500, y: 2500 });

    const noFord = createInitialState(
      1,
      { ...map, rows: [...rows.slice(0, 4), '......~......'] },
      content,
    );
    noFord.tick = dusk.tick;
    const t = step(noFord, [], content);
    const stuck = Number(Object.keys(t.components.gloamling)[0]);
    expect(walkTo(t, content, stuck, [{ x: 10, y: 2 }])).toBe(false);
  });
});

describe('Deposits', () => {
  it("are drawn 's' on Rock, 'c' on Meadow by the river and 'i' on a Mountain face", () => {
    const s = createInitialState(
      1,
      { ...band('meadow'), rows: ['^^^^', '^i..', ':s.c', '~~~~'], villagers: [] },
      content,
    );
    const at = (x: number, y: number) =>
      Object.keys(s.components.tile)
        .map(Number)
        .filter((id) => s.components.tile[id]?.x === x && s.components.tile[id]?.y === y)
        .map((id) => s.components.mapObject[id]?.type);
    expect(at(1, 1)).toEqual(['iron_deposit']);
    expect(at(1, 2)).toEqual(['stone_deposit']);
    expect(at(3, 2)).toEqual(['clay_deposit']);
    expect(s.map.terrain[tileIndex(s.map, 1, 1)]).toBe('mountain');
    expect(s.map.terrain[tileIndex(s.map, 1, 2)]).toBe('rock');
    expect(s.map.terrain[tileIndex(s.map, 3, 2)]).toBe('meadow');
    expect(s.components.mapObject[Number(Object.keys(s.components.mapObject)[0])]?.amount).toBe(
      content.mapObjects.iron_deposit.amount,
    );
  });

  it('refuse a map that puts one where it may not stand', () => {
    const clayAwayFromRiver = { ...band('meadow'), rows: ['.c.', '...', '~~~'], villagers: [] };
    expect(() => createInitialState(1, clayAwayFromRiver, content)).toThrow(/clay_deposit/);
    const ironInsideMountain = { ...band('meadow'), rows: ['^^^', '^i^', '^^^'], villagers: [] };
    expect(() => createInitialState(1, ironInsideMountain, content)).toThrow(/iron_deposit/);
  });

  it('block walking and are worked by nobody yet: the Hero only walks up to them', () => {
    const s = createInitialState(
      1,
      { ...band('meadow'), rows: ['.....', '.s...', '.....'], hero: { x: 3, y: 0 } },
      content,
    );
    expect(walkTo(s, content, 1, [{ x: 1, y: 1 }])).toBe(false);
    expect(heroOrderAt(s, content, { x: 1, y: 1 })).toBeNull();
  });
});
