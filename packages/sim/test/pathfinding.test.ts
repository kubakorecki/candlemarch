import { describe, expect, it } from 'vitest';
import { findPath, type Grid } from '../src/pathfinding';

/** Grid from ASCII: '#' blocked, anything else open. Also returns the index of 'S' and 'G' tiles. */
function grid(rows: string[]): Grid & { at: (ch: string) => number[] } {
  const width = rows[0]?.length ?? 0;
  const cells = rows.join('');
  const blocked = Uint8Array.from([...cells].map((c) => (c === '#' ? 1 : 0)));
  const at = (ch: string) => [...cells].flatMap((c, i) => (c === ch ? [i] : []));
  return { width, height: rows.length, blocked, at };
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
});
