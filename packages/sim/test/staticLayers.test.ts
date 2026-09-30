// The static layers (terrain, map objects, Roads) go to the client only when `staticVersion`
// moves, so every change to them must bump it, and nothing else may.
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { applyCommand, type Command } from '../src/commands';
import { fellTree } from '../src/huntingGrounds';
import { createInitialState, type MapDef } from '../src/map';
import {
  applyStaticPatch,
  joinSnapshot,
  movingPart,
  sentStaticLayers,
  staticChanged,
  staticLayers,
  staticPatch,
} from '../src/snapshot';
import type { GameState } from '../src/state';
import { step, stepInPlace } from '../src/step';
import { content, run } from './helpers';

/** A tree at (1,1), ID 1; open grass elsewhere. */
const glade: MapDef = {
  name: 'glade',
  rows: ['..........', '.T........', '..........', '..........', '..........', '..........'],
  buildings: [],
  villagers: [],
};
const TREE = 1;

/**
 * A wood with berry bushes in its shade (rows 1–5), a woodcutter's hut and a forager's hut
 * working it, a stockpile and a Carrier, and the Hero, who fells the tree at (13,1), the only
 * shade of the bush at (12,1): trees get chopped and felled, bushes picked and left unshaded.
 */
const grove: MapDef = {
  name: 'grove',
  rows: [
    '................',
    '..TbT.......bT..',
    '..T.T.bT........',
    '...TT...........',
    '..bT..T.........',
    '......T.........',
    '................',
    '................',
    '................',
    '................',
  ],
  buildings: [
    { type: 'woodcutters_hut', x: 8, y: 5 },
    { type: 'foragers_hut', x: 5, y: 7 },
  ],
  stockpiles: [{ x: 11, y: 6, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 10, y: 8 }],
  hero: { x: 1, y: 8 },
};

/** The static layers as the issue lists them, read straight off the state. */
function staticJson(s: GameState): string {
  const { mapObject, tile } = s.components;
  const objectTiles = Object.keys(mapObject).map((id) => tile[Number(id)]);
  return JSON.stringify([s.map.terrain, s.map.roads, mapObject, objectTiles]);
}

describe('the static layers version', () => {
  it('moves when a tree is felled', () => {
    const s = createInitialState(1, glade, content);
    const before = s.staticVersion;
    fellTree(s, content, TREE);
    expect(s.staticVersion).toBeGreaterThan(before);
  });

  it('moves when a Road is finished, and when it is removed', () => {
    const s = createInitialState(1, glade, content);
    const path = { from: { x: 3, y: 4 }, to: { x: 8, y: 4 } };
    const before = s.staticVersion;
    applyCommand(s, { type: 'layPath', ...path }, content);
    const laid = s.staticVersion;
    expect(laid).toBeGreaterThan(before);
    applyCommand(s, { type: 'removePath', ...path }, content);
    expect(s.staticVersion).toBeGreaterThan(laid);
  });

  it("stays put over a tick that doesn't change a static layer", () => {
    const s = createInitialState(1, glade, content);
    const next = step(s, [{ type: 'placeBuilding', building: 'hut', x: 5, y: 2 }], content);
    expect(next.staticVersion).toBe(s.staticVersion);
  });

  it("moves when forage patches refill at a season's first Dawn", () => {
    // Summer (from day 6) refills the grove's shaded bushes from spring's 3 to 8.
    const s = { ...createInitialState(1, grove, content), tick: dawnTick(6, content) };
    const next = step(s, [], content);
    expect(staticJson(next)).not.toBe(staticJson(s));
    expect(next.staticVersion).toBeGreaterThan(s.staticVersion);
  });

  it('moves on exactly the ticks that change a static layer, over a working grove', () => {
    let s = createInitialState(1, grove, content);
    const { tile } = s.components;
    const loneTree = Number(
      Object.keys(s.components.mapObject).find((id) => tile[Number(id)]?.x === 13),
    );
    const commandsAt: Record<number, Command[]> = {
      5: [{ type: 'orderHero', order: 'gather', tree: loneTree }],
      40: [{ type: 'layPath', from: { x: 9, y: 9 }, to: { x: 14, y: 9 } }],
      41: [{ type: 'layPath', from: { x: 9, y: 9 }, to: { x: 14, y: 9 } }], // already there
      900: [{ type: 'removePath', from: { x: 12, y: 9 }, to: { x: 14, y: 9 } }],
    };
    let bumps = 0;
    let changes = 0;
    for (let i = 0; i < 3000; i++) {
      const next = step(s, commandsAt[s.tick] ?? [], content);
      const changed = staticJson(next) !== staticJson(s);
      const bumped = next.staticVersion !== s.staticVersion;
      if (changed !== bumped) {
        throw new Error(`tick ${s.tick}: layers changed ${changed}, version moved ${bumped}`);
      }
      if (changed) changes += 1;
      if (bumped) bumps += 1;
      s = next;
    }
    // The run did chop, fell, pick and unshade (else it proves nothing).
    const { mapObject } = s.components;
    const bushes = Object.values(mapObject).filter((o) => o.type === 'berry_bush');
    expect(Object.values(mapObject).filter((o) => o.type === 'tree').length).toBeLessThan(10);
    expect(bushes.some((b) => b.amount < content.mapObjects.berry_bush.amount)).toBe(true);
    expect(bushes.some((b) => b.withered)).toBe(true);
    expect(changes).toBeGreaterThan(10);
    expect(bumps).toBe(changes);
  });
});

describe('split snapshots', () => {
  it('join back into the state they were split from', () => {
    const s = run(createInitialState(1, grove, content), 200);
    const joined = joinSnapshot(movingPart(s), staticLayers(s));
    expect(joined).toEqual(s);
  });

  it('leave terrain, Roads, map objects and their tiles out of the moving part', () => {
    const s = createInitialState(1, grove, content);
    applyCommand(s, { type: 'layPath', from: { x: 9, y: 9 }, to: { x: 14, y: 9 } }, content);
    const moving = movingPart(s);
    expect(moving.map.terrain).toEqual([]);
    expect(moving.map.roads).toEqual({});
    expect(moving.components.mapObject).toEqual({});
    const tiles = Object.keys(moving.components.tile).map(Number);
    expect(tiles.some((id) => s.components.mapObject[id])).toBe(false);
    // The two huts and the stockpile keep their tiles; the 15 map objects go.
    expect(tiles.length).toBe(Object.keys(s.components.tile).length - 15);
  });

  it('join a later moving part with layers sent earlier, while the version stays', () => {
    const s0 = createInitialState(1, glade, content);
    const layers = staticLayers(s0);
    const s1 = run(s0, 20, { 0: [{ type: 'placeBuilding', building: 'hut', x: 5, y: 2 }] });
    expect(s1.staticVersion).toBe(layers.version);
    expect(joinSnapshot(movingPart(s1), layers)).toEqual(s1);
  });

  it("doesn't touch the state it splits", () => {
    const s = createInitialState(1, grove, content);
    const before = JSON.stringify(s);
    movingPart(s);
    staticLayers(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('static patches', () => {
  /** What a posted message carries: a copy, sharing nothing with the state. */
  const posted = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  it('carry the client from the layers first sent to the latest, over a working grove', () => {
    const s = createInitialState(1, grove, content);
    const { tile } = s.components;
    const loneTree = Number(
      Object.keys(s.components.mapObject).find((id) => tile[Number(id)]?.x === 13),
    );
    const commandsAt: Record<number, Command[]> = {
      5: [{ type: 'orderHero', order: 'gather', tree: loneTree }],
      40: [{ type: 'layPath', from: { x: 9, y: 9 }, to: { x: 14, y: 9 } }],
      900: [{ type: 'removePath', from: { x: 12, y: 9 }, to: { x: 14, y: 9 } }],
    };
    let client = posted(staticLayers(s));
    const sent = sentStaticLayers(s);
    let patches = 0;
    for (let i = 0; i < 3000; i++) {
      stepInPlace(s, commandsAt[s.tick] ?? [], content);
      if (s.staticVersion === sent.version) continue;
      client = applyStaticPatch(client, posted(staticPatch(sent, s)));
      patches += 1;
      expect(client).toEqual(staticLayers(s));
    }
    expect(patches).toBeGreaterThan(10);
    // Trees were felled, and a Road laid and taken up, through patches too.
    expect(Object.keys(client.mapObject).length).toBeLessThan(15);
  });

  it('carry only what changed: a chopped tree, and no terrain or Roads', () => {
    const s = createInitialState(1, glade, content);
    const client = posted(staticLayers(s));
    const sent = sentStaticLayers(s);
    const tree = s.components.mapObject[TREE];
    if (!tree) throw new Error('no tree');
    tree.amount -= 1;
    staticChanged(s);
    const patch = staticPatch(sent, s);
    expect(patch).toEqual({
      version: s.staticVersion,
      terrain: null,
      roads: null,
      mapObject: { [TREE]: tree },
      mapObjectTile: { [TREE]: { x: 1, y: 1 } },
      removed: [],
    });
    // The client keeps the layers that didn't change as the same objects.
    const next = applyStaticPatch(client, posted(patch));
    expect(next.terrain).toBe(client.terrain);
    expect(next.roads).toBe(client.roads);
    expect(next.mapObject).not.toBe(client.mapObject);
    expect(next.mapObject[TREE]?.amount).toBe(tree.amount);
  });

  it('carry a felled tree as removed', () => {
    const s = createInitialState(1, glade, content);
    const client = posted(staticLayers(s));
    const sent = sentStaticLayers(s);
    fellTree(s, content, TREE);
    const patch = staticPatch(sent, s);
    expect(patch.removed).toEqual([TREE]);
    expect(applyStaticPatch(client, posted(patch))).toEqual(staticLayers(s));
  });
});
