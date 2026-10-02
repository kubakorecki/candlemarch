// Adjacency (spec, Villagers: Adjacency in M5): a building's like or dislike reaches 4 tiles
// (Chebyshev) from its footprint and touches the residents of Houses there. Each kind counts once
// per House: ten trees still +10, two smokehouses still −10. Standing trees and Reserve tiles are
// one kind (woods).
import type { BuildingId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { adjacencyPreview, happiness, happinessSources } from '../src/happiness';
import { createInitialState, type MapDef } from '../src/map';
import { addToReserve } from '../src/reserves';
import type { EntityId, GameState } from '../src/state';
import { content, run } from './helpers';

const MEADOW = Array.from({ length: 9 }, () => '....................');

/**
 * A Hut at (8,4) (door (8,5)) on a 20×9 Meadow, then `buildings`, then a Carrier at (1,8), run
 * one tick so it's housed. `rows` may add trees or a Shrine (created first, so the Hut is ID 1
 * only without them).
 */
function village(
  buildings: { type: BuildingId; x: number; y: number }[],
  rows: string[] = MEADOW,
): GameState {
  const map: MapDef = {
    name: 'village',
    rows,
    buildings: [{ type: 'hut', x: 8, y: 4 }, ...buildings],
    villagers: [{ job: 'carrier', x: 1, y: 8 }],
  };
  return run(createInitialState(1, map, content), 1);
}

const HUT = 1;

/** The Carrier, a resident of the Hut. */
function resident(s: GameState): EntityId {
  const { villager, building } = s.components;
  const id = Object.keys(villager)
    .map(Number)
    .find((v) => villager[v]?.job === 'carrier');
  const home = id === undefined ? null : (villager[id]?.home ?? null);
  if (id === undefined || home === null || building[home]?.type !== 'hut') {
    throw new Error('no resident');
  }
  return id;
}

/** `rows` with a tree at each of `trees`. */
function withTrees(trees: { x: number; y: number }[], rows: string[] = MEADOW): string[] {
  return rows.map((row, y) =>
    [...row].map((c, x) => (trees.some((t) => t.x === x && t.y === y) ? 'T' : c)).join(''),
  );
}

describe('adjacency', () => {
  it('lowers the happiness of the residents near a smokehouse', () => {
    const s = village([{ type: 'smokehouse', x: 12, y: 4 }]);
    const r = resident(s);
    expect(happinessSources(s, content, r)).toEqual([
      { kind: 'building', building: 'smokehouse', value: -10 },
    ]);
    expect(happiness(s, content, r)).toBe(40);
  });

  it('counts each kind once: two smokehouses are still −10', () => {
    const s = village([
      { type: 'smokehouse', x: 12, y: 4 },
      { type: 'smokehouse', x: 4, y: 2 },
    ]);
    expect(happiness(s, content, resident(s))).toBe(40);
  });

  it('adds different kinds: a smokehouse and a quarry are −20', () => {
    const s = village([
      { type: 'smokehouse', x: 12, y: 4 },
      { type: 'quarry', x: 5, y: 1 },
    ]);
    expect(happiness(s, content, resident(s))).toBe(30);
  });

  it('reaches 4 tiles from the footprint, Chebyshev, and no further', () => {
    for (const at of [
      { x: 12, y: 0 },
      { x: 4, y: 7 },
    ]) {
      const s = village([{ type: 'smokehouse', ...at }]);
      expect(happiness(s, content, resident(s)), `${at.x},${at.y}`).toBe(40);
    }
    for (const at of [
      { x: 13, y: 4 },
      { x: 3, y: 1 },
    ]) {
      const s = village([{ type: 'smokehouse', ...at }]);
      expect(happinessSources(s, content, resident(s)), `${at.x},${at.y}`).toEqual([]);
    }
  });

  it('reaches from the whole footprint: a brewery at (3,2) reaches the Hut from (4,2)', () => {
    const near = village([{ type: 'brewery', x: 3, y: 2 }]);
    expect(happiness(near, content, resident(near))).toBe(60);
    const far = village([{ type: 'brewery', x: 2, y: 2 }]);
    expect(happiness(far, content, resident(far))).toBe(50);
  });

  it('raises it once for trees, however many', () => {
    const one = village([], withTrees([{ x: 5, y: 1 }]));
    expect(happinessSources(one, content, resident(one))).toEqual([{ kind: 'woods', value: 10 }]);
    const many = village(
      [],
      withTrees([
        { x: 5, y: 1 },
        { x: 6, y: 1 },
        { x: 7, y: 1 },
        { x: 11, y: 7 },
        { x: 12, y: 8 },
      ]),
    );
    expect(happiness(many, content, resident(many))).toBe(60);
    const far = village([], withTrees([{ x: 14, y: 4 }]));
    expect(happiness(far, content, resident(far))).toBe(50);
  });

  it('counts a Reserve tile as woods, once with the trees', () => {
    const s = village([]);
    addToReserve(s, [3 * 20 + 11]); // (11,3)
    expect(happinessSources(s, content, resident(s))).toEqual([{ kind: 'woods', value: 10 }]);
    const both = village([], withTrees([{ x: 5, y: 1 }]));
    addToReserve(both, [3 * 20 + 11]);
    expect(happiness(both, content, resident(both))).toBe(60);
  });

  it('likes a Shrine and the brewery: with trees, Happy', () => {
    const rows = withTrees([{ x: 5, y: 1 }]).map((row, y) =>
      y === 8 ? `${row.slice(0, 10)}S${row.slice(11)}` : row,
    );
    const s = village([{ type: 'brewery', x: 9, y: 1 }], rows);
    expect(happinessSources(s, content, resident(s))).toEqual([
      { kind: 'woods', value: 10 },
      { kind: 'poi', poi: 'shrine', value: 10 },
      { kind: 'building', building: 'brewery', value: 10 },
    ]);
    expect(happiness(s, content, resident(s))).toBe(80);
  });

  it("doesn't count a building until it stands", () => {
    const s = village([]);
    s.rank = 'hamlet';
    const placed = run(s, 1, {
      [s.tick]: [{ type: 'placeBuilding', building: 'smokehouse', x: 12, y: 4 }],
    });
    expect(Object.values(placed.components.site).map((site) => site.type)).toEqual(['smokehouse']);
    expect(happiness(placed, content, resident(placed))).toBe(50);
  });

  it("doesn't touch the Homeless", () => {
    const s = createInitialState(
      1,
      {
        name: 'open',
        rows: MEADOW,
        buildings: [{ type: 'smokehouse', x: 2, y: 4 }],
        villagers: [],
      },
      content,
    );
    expect(happinessSources(s, content, 2)).toEqual([{ kind: 'homeless', value: -30 }]);
  });
});

describe('the placement preview', () => {
  it('shows what a building would do to each House it touches', () => {
    const s = village([]);
    expect(adjacencyPreview(s, content, 'smokehouse', { x: 12, y: 4 })).toEqual({
      kind: 'neighbours',
      houses: [{ house: HUT, value: -10 }],
    });
    expect(adjacencyPreview(s, content, 'smokehouse', { x: 13, y: 4 })).toEqual({
      kind: 'neighbours',
      houses: [],
    });
  });

  it('shows 0 for a House that already has that kind nearby', () => {
    const s = village([{ type: 'smokehouse', x: 4, y: 2 }]);
    expect(adjacencyPreview(s, content, 'smokehouse', { x: 12, y: 4 })).toEqual({
      kind: 'neighbours',
      houses: [{ house: HUT, value: 0 }],
    });
  });

  it('shows what a House would get from its neighbours', () => {
    const s = village([
      { type: 'smokehouse', x: 15, y: 4 },
      { type: 'brewery', x: 15, y: 2 },
    ]);
    expect(adjacencyPreview(s, content, 'hut', { x: 17, y: 6 })).toEqual({
      kind: 'house',
      sources: [
        { kind: 'building', building: 'smokehouse', value: -10 },
        { kind: 'building', building: 'brewery', value: 10 },
      ],
      total: 0,
    });
  });

  it('is null for a building that neither likes nor is a House', () => {
    expect(adjacencyPreview(village([]), content, 'granary', { x: 12, y: 4 })).toBeNull();
  });
});
