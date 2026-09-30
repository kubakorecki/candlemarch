// The walk grid is cached between calls until the map changes: it must always match the map.
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/commands';
import { footprint, tileIndex } from '../src/grid';
import { fellTree } from '../src/huntingGrounds';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { walkGrid } from '../src/systems/movement';
import { content } from './helpers';

/** A tree at (1,1), ID 1; open Meadow elsewhere. */
const glade: MapDef = {
  name: 'glade',
  rows: ['..........', '.T........', '..........', '..........', '..........', '..........'],
  buildings: [],
  villagers: [],
};
const TREE = 1;

const blockedAt = (s: GameState, t: Tile) =>
  walkGrid(s, content).blocked[tileIndex(s.map, t.x, t.y)];
const speedAt = (s: GameState, t: Tile) =>
  walkGrid(s, content).speedPercent[tileIndex(s.map, t.x, t.y)];
const hutTiles = (x: number, y: number) => footprint(content.buildings.hut, { x, y });

describe('the walk grid', () => {
  it("walks a tree's tile at its speed, and at full speed once it's felled", () => {
    const s = createInitialState(1, glade, content);
    expect(blockedAt(s, { x: 1, y: 1 })).toBe(0);
    expect(speedAt(s, { x: 1, y: 1 })).toBe(content.mapObjects.tree.walkSpeedPercent);
    fellTree(s, content, TREE);
    expect(speedAt(s, { x: 1, y: 1 })).toBe(100);
  });

  it('speeds up a tile a path is laid on, and slows it again when the path goes', () => {
    const s = createInitialState(1, glade, content);
    const tile = { x: 5, y: 0 };
    expect(speedAt(s, tile)).toBe(100);
    applyCommand(s, { type: 'layPath', from: { x: 4, y: 0 }, to: { x: 6, y: 0 } }, content);
    expect(speedAt(s, tile)).toBe(content.roads.dirt_path.speedPercent);
    applyCommand(s, { type: 'removePath', from: { x: 4, y: 0 }, to: { x: 6, y: 0 } }, content);
    expect(speedAt(s, tile)).toBe(100);
  });

  it('blocks a placed site, and opens it again when it is cancelled', () => {
    const s = createInitialState(1, glade, content);
    const [tile] = hutTiles(5, 2);
    expect(blockedAt(s, tile as Tile)).toBe(0);
    const site = s.nextId;
    applyCommand(s, { type: 'placeBuilding', building: 'hut', x: 5, y: 2 }, content);
    expect(blockedAt(s, tile as Tile)).toBe(1);
    applyCommand(s, { type: 'cancelConstruction', siteId: site }, content);
    expect(blockedAt(s, tile as Tile)).toBe(0);
  });

  it('stays apart in states stepped apart from the same one', () => {
    const s0 = createInitialState(1, glade, content);
    expect(blockedAt(s0, { x: 5, y: 2 })).toBe(0);
    const a = step(s0, [{ type: 'placeBuilding', building: 'hut', x: 5, y: 2 }], content);
    const b = step(s0, [{ type: 'placeBuilding', building: 'hut', x: 2, y: 3 }], content);
    for (const t of hutTiles(5, 2)) {
      expect([blockedAt(a, t), blockedAt(b, t), blockedAt(s0, t)]).toEqual([1, 0, 0]);
    }
    for (const t of hutTiles(2, 3)) {
      expect([blockedAt(a, t), blockedAt(b, t), blockedAt(s0, t)]).toEqual([0, 1, 0]);
    }
  });
});
