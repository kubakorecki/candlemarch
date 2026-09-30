// Trees slow walkers instead of blocking them, and still keep anything from being placed on them
// (spec, World and map: "Terrain"; food-balance/03).
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import { canPlaceBuilding, tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath } from '../src/roads';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { canPlaceStockpile } from '../src/stockpiles';
import { movementSystem, walkTo } from '../src/systems/movement';
import { content } from './helpers';

/** 12×3: a wood over columns 1–10 of every row, Meadow in columns 0 and 11, a Carrier at (0,1). */
const wood: MapDef = {
  name: 'wood',
  rows: ['.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.'],
  buildings: [],
  villagers: [{ job: 'carrier', x: 0, y: 1 }],
};

/** The Carrier's ID: the trees are made before it. */
function carrierOf(s: GameState): number {
  return Number(Object.keys(s.components.villager)[0]);
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

describe('trees', () => {
  it('are walked through at half speed, like Swamp', () => {
    const s = createInitialState(1, wood, content);
    const carrier = carrierOf(s);
    expect(walkTo(s, content, carrier, [{ x: 10, y: 1 }])).toBe(true);
    // 10 tiles of 1000 units at 37 units a tick (terrain.test.ts: Swamp takes the same).
    expect(walk(s, carrier)).toBe(271);
  });

  it('are walked round when the way round is quicker', () => {
    const s = createInitialState(1, { ...wood, rows: ['.......', '.TTTTT.', '.......'] }, content);
    expect(walkTo(s, content, carrierOf(s), [{ x: 6, y: 1 }])).toBe(true);
    const tiles = s.components.path[carrierOf(s)]?.tiles ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    for (const i of tiles) expect(i).not.toBe(tileIndex(s.map, 3, 1));
  });

  it('let the Hero and Gloamlings through too', () => {
    // A wood across the whole map at column 6, a Den west of it. Its Gloamling comes out at the
    // first Dusk tick.
    const rows = Array(5).fill('......T......');
    rows[2] = '..D...T......';
    const map: MapDef = {
      name: 'wall of trees',
      rows,
      buildings: [],
      villagers: [],
      hero: { x: 0, y: 0 },
    };
    const dusk = createInitialState(1, map, content);
    dusk.tick = duskTick(1, content);
    const s = step(dusk, [], content);
    const gloamling = Number(Object.keys(s.components.gloamling)[0]);
    delete s.components.path[gloamling];
    expect(walkTo(s, content, gloamling, [{ x: 10, y: 2 }])).toBe(true);
    const hero = Number(Object.keys(s.components.hero)[0]);
    expect(walkTo(s, content, hero, [{ x: 10, y: 0 }])).toBe(true);
  });

  it('still block building, paving and piling', () => {
    // A tree at (2,2); a Hut is 1×1 with its door south.
    const s = createInitialState(
      1,
      { ...wood, rows: ['......', '......', '..T...', '......', '......'] },
      content,
    );
    expect(canPlaceBuilding(s, content, 'hut', 2, 2)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 2, 1)).toBe(false); // its door on the tree
    expect(canPlaceBuilding(s, content, 'hut', 3, 1)).toBe(true);
    expect(canPlaceStockpile(s, content, 1, 1, 2, 2)).toBe(false);
    expect(canLayPath(s, content, { x: 0, y: 2 }, { x: 4, y: 2 })).toBe(false);
    expect(canPlaceBuilding(s, content, 'palisade', 2, 2)).toBe(false);
  });

  it('are the only map objects walked through: Forage patches still block', () => {
    const s = createInitialState(1, { ...wood, rows: ['...', '.b.', '...'] }, content);
    expect(walkTo(s, content, carrierOf(s), [{ x: 1, y: 1 }])).toBe(false);
  });
});
