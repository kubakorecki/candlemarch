import type { MapObjectComponent, Store, Tile } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { MapObjectRuns, ROW_RUN_TILES } from '../src/render/mapObjectRuns';

/** A map-object store and its tiles from `[id, x, y, amount]` rows, all trees. */
function trees(rows: [number, number, number, number][]): {
  mapObject: Store<MapObjectComponent>;
  tile: Store<Tile>;
} {
  const mapObject: Store<MapObjectComponent> = {};
  const tile: Store<Tile> = {};
  for (const [id, x, y, amount] of rows) {
    mapObject[id] = { type: 'tree', amount };
    tile[id] = { x, y };
  }
  return { mapObject, tile };
}

const tilesOf = (runs: MapObjectRuns, key: string) =>
  runs.objectsIn(key).map((o) => `${o.x},${o.y}`);

describe('map object runs', () => {
  it('groups objects on one diagonal of tiles, a run at a time, and reports them all at first', () => {
    expect(ROW_RUN_TILES).toBe(16);
    const runs = new MapObjectRuns();
    // (3, 21) and (6, 18) share a diagonal (x + y = 24) and a run; (4, 21) is on the next
    // diagonal; (19, 5) is on the first diagonal, but in the next run along it (x 16–31).
    const { mapObject, tile } = trees([
      [1, 3, 21, 10],
      [2, 6, 18, 10],
      [3, 4, 21, 10],
      [4, 19, 5, 10],
    ]);
    const dirty = [...runs.update(mapObject, tile)];
    const described = dirty
      .map((key) => `${runs.depthOf(key)}: ${tilesOf(runs, key).join(' ')}`)
      .sort();
    expect(described).toEqual(['24: 19,5', '24: 3,21 6,18', '25: 4,21']);
  });

  it('reports nothing when nothing changed, however new the store object is', () => {
    const runs = new MapObjectRuns();
    runs.update(trees([[1, 3, 5, 10]]).mapObject, trees([[1, 3, 5, 10]]).tile);
    const again = trees([[1, 3, 5, 10]]);
    expect(runs.update(again.mapObject, again.tile).size).toBe(0);
  });

  it('reports only the run of an object whose amount or withering changed', () => {
    const runs = new MapObjectRuns();
    const before = trees([
      [1, 3, 5, 10],
      [2, 6, 2, 10],
      [3, 4, 5, 10],
    ]);
    runs.update(before.mapObject, before.tile);
    const after = trees([
      [1, 3, 5, 10],
      [2, 6, 2, 9],
      [3, 4, 5, 10],
    ]);
    const dirty = [...runs.update(after.mapObject, after.tile)];
    expect(dirty.map((key) => tilesOf(runs, key).sort().join(' '))).toEqual(['3,5 6,2']);
    expect(runs.objectsIn(dirty[0] as string).find((o) => o.x === 6)?.amount).toBe(9);

    after.mapObject[3] = { type: 'tree', amount: 10, withered: true };
    const withered = [...runs.update(after.mapObject, after.tile)];
    expect(withered.map((key) => tilesOf(runs, key))).toEqual([['4,5']]);
  });

  it('reports the run of a removed object, and an emptied run with nothing in it', () => {
    const runs = new MapObjectRuns();
    const before = trees([
      [1, 3, 5, 10],
      [2, 6, 2, 10],
      [3, 4, 5, 10],
    ]);
    runs.update(before.mapObject, before.tile);
    const after = trees([[1, 3, 5, 10]]);
    const dirty = [...runs.update(after.mapObject, after.tile)];
    expect(dirty.map((key) => tilesOf(runs, key)).sort()).toEqual([[], ['3,5']]);
  });
});
