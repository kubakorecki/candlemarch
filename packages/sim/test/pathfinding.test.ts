import { describe, expect, it } from 'vitest';
import { canReach, costSearch, findPath, type Grid, regions } from '../src/pathfinding';

const ROAD_PERCENT = 150;

/**
 * Grid from ASCII: '#' blocked, '=' a road walked at 150%, anything else open off-road.
 * Also returns the indices of tiles holding a given character.
 */
function grid(rows: string[]): Grid & { at: (ch: string) => number[] } {
  const width = rows[0]?.length ?? 0;
  const cells = rows.join('');
  const blocked = Uint8Array.from([...cells].map((c) => (c === '#' ? 1 : 0)));
  const speedPercent = Uint16Array.from([...cells].map((c) => (c === '=' ? ROAD_PERCENT : 100)));
  const at = (ch: string) => [...cells].flatMap((c, i) => (c === ch ? [i] : []));
  return {
    width,
    height: rows.length,
    blocked,
    speedPercent,
    maxSpeedPercent: ROAD_PERCENT,
    at,
  };
}

describe('findPath', () => {
  it('walks a straight line', () => {
    const g = grid(['S...G']);
    expect(findPath(g, 0, [4])).toEqual([1, 2, 3, 4]);
  });

  it('prefers a diagonal over two orthogonal steps', () => {
    const g = grid(['S..', '...', '..G']);
    expect(findPath(g, 0, [8])).toEqual([4, 8]);
  });

  it('detours around a wall', () => {
    const g = grid(['S#G', '.#.', '...']);
    // No diagonal 3->7 or 7->5: each would squeeze past the wall at 4.
    expect(findPath(g, 0, [2])).toEqual([3, 6, 7, 8, 5, 2]);
  });

  it("doesn't cut corners past a blocked tile", () => {
    // Diagonal from S (0) to G (3) would squeeze past the blocked tile at 1.
    const g = grid(['S#', '.G']);
    expect(findPath(g, 0, [3])).toEqual([2, 3]);
  });

  it('returns null when no goal is reachable', () => {
    const g = grid(['S#G']);
    expect(findPath(g, 0, [2])).toBeNull();
  });

  it('returns [] when already at a goal, and ignores blocked goals', () => {
    const g = grid(['S.#']);
    expect(findPath(g, 0, [0])).toEqual([]);
    expect(findPath(g, 0, [2])).toBeNull();
  });

  it('reaches the nearest of several goals', () => {
    const g = grid(['G..S.G']);
    // Goals at 0 (distance 3) and 5 (distance 2).
    expect(findPath(g, 3, [0, 5])).toEqual([4, 5]);
  });

  it('can leave a blocked start tile', () => {
    const g = grid(['#..']);
    expect(findPath(g, 0, [2])).toEqual([1, 2]);
  });

  it('is deterministic when several shortest paths exist', () => {
    const g = grid(['S...', '....', '....', '...G']);
    const first = findPath(g, 0, [15]);
    for (let i = 0; i < 5; i++) expect(findPath(g, 0, [15])).toEqual(first);
  });

  it('takes a road that is longer in tiles but faster', () => {
    const g = grid([
      'S........G', //
      '=........=',
      '==========',
    ]);
    // Straight: 9 × 1000 = 9000. Along the road, cutting its corners diagonally:
    // 666 + 942 + 7 × 666 + 942 + 1000 (onto G, off-road) = 8212.
    expect(findPath(g, 0, [9])).toEqual([10, 21, 22, 23, 24, 25, 26, 27, 28, 19, 9]);
  });

  it('ignores a road when the detour costs more than it saves', () => {
    const g = grid([
      'S........G', //
      '=........=',
      '=........=',
      '=........=',
      '=........=',
      '==========',
    ]);
    // Along the road: 12 208, more than the straight 9000.
    expect(findPath(g, 0, [9])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('costSearch', () => {
  // S at (0,0); a road tile at (2,0), walked at 150%: a step onto it costs 666, a diagonal 942.
  // Z at (5,1) is walled off.
  const rows = ['S.=.#.', '....#Z', '#####.'];
  const index = (x: number, y: number) => y * 6 + x;

  it('gives the walking cost to each tile asked for, in any order', () => {
    const search = costSearch(grid(rows), 0);
    // Along the top row onto the road, then a diagonal off it: 1000 + 666 + 1414.
    expect(search.costTo(index(3, 1))).toBe(3080);
    expect(search.costTo(index(1, 0))).toBe(1000);
    expect(search.costTo(index(2, 0))).toBe(1666);
    expect(search.costTo(index(1, 1))).toBe(1414);
    expect(search.costTo(index(3, 1))).toBe(3080);
    expect(search.costTo(index(0, 0))).toBe(0);
  });

  it('gives Infinity for a tile that cannot be reached, blocked or off the grid', () => {
    const search = costSearch(grid(rows), 0);
    expect(search.costTo(index(5, 1))).toBe(Number.POSITIVE_INFINITY);
    expect(search.costTo(index(4, 0))).toBe(Number.POSITIVE_INFINITY);
    expect(search.costTo(-1)).toBe(Number.POSITIVE_INFINITY);
    // Asked after the whole reachable area was searched.
    expect(search.costTo(index(3, 0))).toBe(2666);
  });
});

describe('canReach', () => {
  const check = (rows: string[], start: number, goals: number[]) => {
    const g = grid(rows);
    return canReach(g, regions(g), start, goals);
  };

  it('reaches a goal round a wall', () => {
    expect(check(['S#.', '.#G', '...'], 0, [5])).toBe(true);
  });

  it("doesn't squeeze diagonally between two blocked corners", () => {
    // G's only way in is the gap between the two walls' corners.
    expect(check(['S#', '#G'], 0, [3])).toBe(false);
  });

  it('is false with every goal blocked, off the grid or walled off, like findPath', () => {
    const rows = ['S..#.', '...#G', '...##'];
    expect(check(rows, 0, [9, 3, -1, 99])).toBe(false);
    expect(findPath(grid(rows), 0, [9, 3, -1, 99])).toBeNull();
  });

  it('can leave a blocked start tile, but only where findPath could', () => {
    // Starting on the blocked middle tile: G's corner is cut off by the walls either side.
    expect(check(['G#.', '##.', '...'], 4, [0])).toBe(false);
    expect(findPath(grid(['G#.', '##.', '...']), 4, [0])).toBeNull();
    // With the tile north of it open, it can.
    expect(check(['G..', '##.', '...'], 4, [0])).toBe(true);
  });

  it('is true when already on a goal', () => {
    expect(check(['S'], 0, [0])).toBe(true);
  });
});
