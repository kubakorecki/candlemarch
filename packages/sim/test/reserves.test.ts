import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { noTiles, setTile } from '../src/fog';
import { canPlaceBuilding, tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { canPaintReserve, inReserve, reserveNear } from '../src/reserves';
import { deserialize, serialize } from '../src/save';
import type { GameState, Tile } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * Two trees and a woodcutter's hut (door (2,4)): tree (5,1) is the nearer, (6,2) the farther.
 * A carrier keeps the hut's buffer drained.
 */
const grove: MapDef = {
  name: 'grove',
  rows: ['........', '.....T..', '......T.', '........', '........', '........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 2 }],
  villagers: [{ job: 'carrier', x: 0, y: 5 }],
};

function treeAt(s: GameState, x: number, y: number): number {
  return idsOf(s.components.mapObject).find((id) => {
    const t = s.components.tile[id];
    return t?.x === x && t.y === y;
  }) as number;
}

function woodcutterTask(s: GameState) {
  const id = idsOf(s.components.woodcutter)[0] as number;
  return s.components.woodcutter[id];
}

function paint(from: Tile, to: Tile = from): Command {
  return { type: 'paintReserve', from, to };
}

function erase(from: Tile, to: Tile = from): Command {
  return { type: 'eraseReserve', from, to };
}

/** The Reserve's tiles as "x,y", row by row. */
function reserved(s: GameState): string[] {
  const tiles: string[] = [];
  for (let y = 0; y < s.map.height; y++) {
    for (let x = 0; x < s.map.width; x++) if (inReserve(s, { x, y })) tiles.push(`${x},${y}`);
  }
  return tiles;
}

describe('Reserves', () => {
  it('a woodcutter skips a tree in a Reserve and fells the nearest one outside it', () => {
    const s0 = createInitialState(1, grove, content);
    const reserved = treeAt(s0, 5, 1);
    const outside = treeAt(s0, 6, 2);
    const s1 = run(s0, 1, { 0: [paint({ x: 5, y: 1 })] });
    expect(woodcutterTask(s1)).toEqual({ kind: 'toTree', tree: outside });

    const felled = runUntil(s1, (s) => s.components.mapObject[outside]?.type === 'stump', 5000);
    const later = run(felled, 3000);
    expect(later.components.mapObject[reserved]).toMatchObject({ type: 'tree' });
    expect(woodcutterTask(later)?.kind).toBe('idle');
  });

  it('a woodcutter on its way to a tree turns back when the tree is painted into a Reserve', () => {
    const s0 = createInitialState(1, grove, content);
    const near = treeAt(s0, 5, 1);
    const far = treeAt(s0, 6, 2);
    const walking = run(s0, 5);
    expect(woodcutterTask(walking)).toEqual({ kind: 'toTree', tree: near });
    const s = runUntil(walking, (x) => x.components.mapObject[far]?.type === 'stump', 5000, {
      [walking.tick]: [paint({ x: 5, y: 1 })],
    });
    expect(s.components.mapObject[far]?.type).toBe('stump');
    expect(s.components.mapObject[near]).toMatchObject({ type: 'tree', amount: 3 });
  });

  it('paints and erases a rectangle between two corner tiles, in either order', () => {
    const s0 = createInitialState(1, grove, content);
    const painted = run(s0, 1, { 0: [paint({ x: 6, y: 2 }, { x: 4, y: 1 })] });
    expect(reserved(painted)).toEqual(['4,1', '5,1', '6,1', '4,2', '5,2', '6,2']);
    const erased = run(painted, 1, { 1: [erase({ x: 5, y: 3 }, { x: 5, y: 0 })] });
    expect(reserved(erased)).toEqual(['4,1', '6,1', '4,2', '6,2']);
  });

  it('frees a tree for felling once erased', () => {
    const s0 = createInitialState(1, grove, content);
    const near = treeAt(s0, 5, 1);
    const commands = { 0: [paint({ x: 4, y: 0 }, { x: 7, y: 3 })], 1: [erase({ x: 5, y: 1 })] };
    const nothing = run(s0, 2, commands);
    expect(woodcutterTask(nothing)?.kind).toBe('idle');
    const s = runUntil(nothing, (x) => woodcutterTask(x)?.kind !== 'idle', 200);
    expect(woodcutterTask(s)).toEqual({ kind: 'toTree', tree: near });
  });

  it('is painted only where every tile is Revealed and both corners are on the map', () => {
    const s = createInitialState(1, grove, content);
    s.fog = true;
    s.map.revealed = noTiles(s.map);
    for (let x = 0; x <= 5; x++) setTile(s.map.revealed, tileIndex(s.map, x, 1));
    expect(canPaintReserve(s, { x: 0, y: 1 }, { x: 5, y: 1 })).toBe(true);
    expect(canPaintReserve(s, { x: 0, y: 1 }, { x: 6, y: 1 })).toBe(false);
    expect(canPaintReserve(s, { x: 5, y: 1 }, { x: 5, y: 2 })).toBe(false);
    s.fog = false;
    expect(canPaintReserve(s, { x: 0, y: 0 }, { x: 8, y: 0 })).toBe(false);
    const refused = run(s, 1, { 0: [paint({ x: 0, y: 0 }, { x: 8, y: 0 })] });
    expect(reserved(refused)).toEqual([]);
  });

  it("doesn't block building", () => {
    const s0 = createInitialState(1, grove, content);
    const s = run(s0, 1, { 0: [paint({ x: 0, y: 0 }, { x: 7, y: 5 })] });
    expect(canPlaceBuilding(s, content, 'hut', 4, 3)).toBe(true);
    const built = run(s, 1, { 1: [{ type: 'placeBuilding', building: 'hut', x: 4, y: 3 }] });
    expect(Object.values(built.components.site).map((site) => site.type)).toContain('hut');
  });

  it('survives save and load, and the loaded game carries on as an unbroken one', () => {
    const commands = { 0: [paint({ x: 5, y: 1 })] };
    const s0 = createInitialState(1, grove, content);
    const mid = run(s0, 300, commands);
    const loaded = deserialize(serialize(mid), content);
    expect(reserved(loaded)).toEqual(['5,1']);
    expect(run(loaded, 1500)).toEqual(run(mid, 1500));
  });

  it('loads as no Reserve from a save made before Reserves', () => {
    const s = createInitialState(1, grove, content);
    const old = JSON.parse(serialize(s));
    delete old.map.reserve;
    const loaded = deserialize(JSON.stringify(old), content);
    expect(reserved(loaded)).toEqual([]);
    const painted = run(loaded, 1, { 0: [paint({ x: 7, y: 5 })] });
    expect(JSON.parse(serialize(painted)).map.reserve).not.toContain(null);
    expect(reserved(painted)).toEqual(['7,5']);
  });

  it("lists the Reserve tiles in a woodcutter's hut's radius for its placement preview", () => {
    const wide: MapDef = {
      name: 'wide',
      rows: Array(30).fill('.'.repeat(30)),
      buildings: [],
      villagers: [],
    };
    const s = run(createInitialState(1, wide, content), 1, {
      0: [paint({ x: 0, y: 5 }, { x: 29, y: 5 })],
    });
    const radius = content.buildings.woodcutters_hut.workRadius as number;
    const { w } = content.buildings.woodcutters_hut.size;
    const tiles = reserveNear(s, content, 'woodcutters_hut', { x: 10, y: 3 });
    // Row 5, from `radius` left of the footprint to `radius` right of it.
    expect(tiles.map((t) => t.x)).toEqual(
      Array.from({ length: w + 2 * radius }, (_, i) => 10 - radius + i),
    );
    expect(tiles.every((t) => t.y === 5)).toBe(true);
    expect(reserveNear(s, content, 'woodcutters_hut', { x: 10, y: 5 + radius + 1 })).toEqual([]);
    // Nothing for a building that doesn't fell trees.
    expect(reserveNear(s, content, 'foragers_hut', { x: 10, y: 3 })).toEqual([]);
  });
});
