import { describe, expect, it } from 'vitest';
import { canPlaceBuilding, isRiverbank, tileIndex, tileOfPoint } from '../src/grid';
import { heroOf, heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath } from '../src/roads';
import type { GameState, Tile } from '../src/state';
import { canPlaceStockpile } from '../src/stockpiles';
import { content, run } from './helpers';

/** 7×5 with a river down column 3, the hero on the west bank. `ford` leaves row 4 as grass. */
function riverMap(ford: boolean): MapDef {
  return {
    name: 'river',
    rows: ['...~...', '...~...', '...~...', '...~...', ford ? '.......' : '...~...'],
    buildings: [],
    villagers: [],
    hero: { x: 1, y: 1 },
  };
}

function heroTile(s: GameState): Tile {
  const id = heroOf(s);
  const pos = id === null ? undefined : s.components.position[id];
  if (!pos) throw new Error('no hero');
  return tileOfPoint(pos);
}

describe('river terrain', () => {
  it("is drawn with '~' in map rows", () => {
    const s = createInitialState(1, riverMap(false), content);
    expect(s.map.terrain[tileIndex(s.map, 3, 0)]).toBe('river');
    expect(s.map.terrain[tileIndex(s.map, 2, 0)]).toBe('grass');
  });

  it('blocks walking: no way across without a ford', () => {
    const s = createInitialState(1, riverMap(false), content);
    const after = run(s, 200, { 0: [{ type: 'orderHero', order: 'move', x: 5, y: 1 }] });
    expect(heroTile(after)).toEqual({ x: 1, y: 1 });
  });

  it('is walked around through a ford, never across', () => {
    let s = createInitialState(1, riverMap(true), content);
    s = run(s, 1, { 0: [{ type: 'orderHero', order: 'move', x: 5, y: 1 }] });
    const hero = heroOf(s);
    const path = hero === null ? undefined : s.components.path[hero];
    expect(path?.tiles).toContain(tileIndex(s.map, 3, 4));
    for (const i of path?.tiles ?? []) expect(s.map.terrain[i]).toBe('grass');
    expect(heroTile(run(s, 400))).toEqual({ x: 5, y: 1 });
  });

  it('refuses buildings, stockpiles and paths', () => {
    const s = createInitialState(1, riverMap(false), content);
    expect(canPlaceBuilding(s, content, 'hut', 3, 1)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 3, 3)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 4, 1)).toBe(true);
    // A hut on grass whose door (one tile south) would be in the river.
    const shore = createInitialState(
      1,
      { ...riverMap(false), rows: ['.', '~'], hero: { x: 0, y: 0 } },
      content,
    );
    expect(canPlaceBuilding(shore, content, 'hut', 0, 0)).toBe(false);
    expect(canPlaceStockpile(s, content, 2, 1, 2, 2)).toBe(false);
    expect(canPlaceStockpile(s, content, 1, 1, 2, 2)).toBe(true);
    expect(canLayPath(s, content, { x: 1, y: 2 }, { x: 5, y: 2 })).toBe(false);
    expect(canLayPath(s, content, { x: 0, y: 2 }, { x: 2, y: 2 })).toBe(true);
  });

  it('gives the hero no order on a river tile', () => {
    const s = createInitialState(1, riverMap(false), content);
    expect(heroOrderAt(s, content, { x: 3, y: 2 })).toBeNull();
    expect(heroOrderAt(s, content, { x: 2, y: 2 })).toEqual({ order: 'move', x: 2, y: 2 });
  });

  it("won't start villagers or the hero in the river", () => {
    const map = riverMap(false);
    expect(() =>
      createInitialState(1, { ...map, villagers: [{ job: 'carrier', x: 3, y: 0 }] }, content),
    ).toThrow(/villager/);
    expect(() => createInitialState(1, { ...map, hero: { x: 3, y: 0 } }, content)).toThrow(/hero/);
  });
});

describe('isRiverbank', () => {
  // River in the middle column of rows 0–1; a tree at (0,2) diagonal to it and one at (2,1)
  // beside it.
  const map: MapDef = {
    name: 'bank',
    rows: ['.~.', '.~T', 'T..'],
    buildings: [],
    villagers: [],
  };
  const s = createInitialState(1, map, content);

  it('is a walkable tile orthogonally next to the river', () => {
    expect(isRiverbank(s, content, { x: 0, y: 0 })).toBe(true);
    expect(isRiverbank(s, content, { x: 1, y: 2 })).toBe(true);
  });

  it('counts the terrain, not what stands on it', () => {
    expect(isRiverbank(s, content, { x: 2, y: 1 })).toBe(true);
  });

  it("isn't the river itself, a diagonal neighbour or off the map", () => {
    expect(isRiverbank(s, content, { x: 1, y: 0 })).toBe(false);
    expect(isRiverbank(s, content, { x: 0, y: 2 })).toBe(false);
    expect(isRiverbank(s, content, { x: 2, y: 2 })).toBe(false);
    expect(isRiverbank(s, content, { x: -1, y: 0 })).toBe(false);
    expect(isRiverbank(s, content, { x: 3, y: 0 })).toBe(false);
  });
});
