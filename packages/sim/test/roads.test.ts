import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath, lShapeTiles, roadNeighbours } from '../src/roads';
import type { GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { content } from './helpers';

// 8×5 with a tree at (5,1).
const yard: MapDef = {
  name: 'yard',
  rows: ['........', '.....T..', '........', '........', '........'],
  buildings: [],
  villagers: [],
};

/** The yard with a hut construction site at (1,3); its door is (1,4). */
function yardWithSite(): GameState {
  const s0 = createInitialState(1, yard, content);
  return step(s0, [{ type: 'placeBuilding', building: 'hut', x: 1, y: 3 }], content);
}

const lay = (from: Tile, to: Tile): Command => ({ type: 'layPath', from, to });

/** Tiles holding a road, as "x,y" strings in tile-index order. */
function roadTiles(s: GameState): string[] {
  return Object.keys(s.map.roads)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => `${i % s.map.width},${Math.floor(i / s.map.width)}`);
}

describe('layPath', () => {
  it('lays an L: horizontal leg from `from`, then vertical leg to `to`', () => {
    const s0 = createInitialState(1, yard, content);
    const s = step(s0, [lay({ x: 0, y: 0 }, { x: 2, y: 2 })], content);
    expect(roadTiles(s)).toEqual(['0,0', '1,0', '2,0', '2,1', '2,2']);
    expect(s.map.roads[tileIndex(s.map, 2, 1)]).toBe('dirt_path');
  });

  it('lays an L drawn right to left and bottom to top', () => {
    const s0 = createInitialState(1, yard, content);
    const s = step(s0, [lay({ x: 3, y: 2 }, { x: 1, y: 0 })], content);
    expect(roadTiles(s)).toEqual(['1,0', '1,1', '1,2', '2,2', '3,2']);
  });

  it('ignores the whole L when any tile is invalid', () => {
    const s0 = yardWithSite();
    const invalid: [Tile, Tile, string][] = [
      [{ x: 3, y: 1 }, { x: 7, y: 1 }, 'crosses the tree'],
      [{ x: 0, y: 3 }, { x: 2, y: 3 }, 'crosses the site footprint'],
      [{ x: 6, y: 0 }, { x: 8, y: 0 }, 'runs off the map'],
      [{ x: -1, y: 0 }, { x: 2, y: 0 }, 'starts off the map'],
      [{ x: 0, y: 0 }, { x: 2.5, y: 0 }, 'not a whole tile'],
    ];
    for (const [from, to, why] of invalid) {
      expect(canLayPath(s0, content, from, to), why).toBe(false);
      const s = step(s0, [lay(from, to)], content);
      expect(roadTiles(s), why).toEqual([]);
    }
  });

  it('may cross door tiles and existing paths', () => {
    const s0 = yardWithSite();
    expect(canLayPath(s0, content, { x: 0, y: 4 }, { x: 3, y: 4 })).toBe(true);
    const s1 = step(s0, [lay({ x: 0, y: 4 }, { x: 3, y: 4 })], content);
    const s2 = step(s1, [lay({ x: 2, y: 2 }, { x: 2, y: 4 })], content);
    expect(roadTiles(s2)).toEqual(['2,2', '2,3', '0,4', '1,4', '2,4', '3,4']);
  });
});

describe('lShapeTiles', () => {
  it('is one tile when both ends are the same', () => {
    expect(lShapeTiles({ x: 3, y: 2 }, { x: 3, y: 2 })).toEqual([{ x: 3, y: 2 }]);
  });

  it('stays finite for ends that are not whole tiles', () => {
    expect(lShapeTiles({ x: 0, y: 0 }, { x: 1.5, y: 0 })).toHaveLength(3);
  });
});

describe('removePath', () => {
  it('clears path tiles along the L and leaves the rest', () => {
    const s0 = createInitialState(1, yard, content);
    const s1 = step(s0, [lay({ x: 0, y: 0 }, { x: 4, y: 2 })], content);
    const remove: Command = { type: 'removePath', from: { x: 3, y: 0 }, to: { x: 4, y: 1 } };
    const s2 = step(s1, [remove], content);
    expect(roadTiles(s2)).toEqual(['0,0', '1,0', '2,0', '4,2']);
  });

  it('ignores an L that leaves the map', () => {
    const s0 = createInitialState(1, yard, content);
    const s1 = step(s0, [lay({ x: 0, y: 0 }, { x: 2, y: 0 })], content);
    const remove: Command = { type: 'removePath', from: { x: 0, y: 0 }, to: { x: 99, y: 0 } };
    expect(roadTiles(step(s1, [remove], content))).toEqual(['0,0', '1,0', '2,0']);
  });
});

describe('roadNeighbours', () => {
  it('links path tiles that share an edge, never diagonally', () => {
    const s0 = createInitialState(1, yard, content);
    // A T: (0,2)-(4,2) with a stem up to (2,0), plus a lone tile at (5,3), diagonal to (4,2).
    const s = step(
      s0,
      [
        lay({ x: 0, y: 2 }, { x: 4, y: 2 }),
        lay({ x: 2, y: 0 }, { x: 2, y: 1 }),
        lay({ x: 5, y: 3 }, { x: 5, y: 3 }),
      ],
      content,
    );
    const at = (x: number, y: number) => tileIndex(s.map, x, y);
    expect(roadNeighbours(s.map, at(2, 2))).toEqual([at(3, 2), at(1, 2), at(2, 1)]);
    expect(roadNeighbours(s.map, at(4, 2))).toEqual([at(3, 2)]);
    expect(roadNeighbours(s.map, at(5, 3))).toEqual([]);
    expect(roadNeighbours(s.map, at(0, 2))).toEqual([at(1, 2)]); // map edge
  });
});
