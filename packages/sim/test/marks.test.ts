import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { noTiles, setTile } from '../src/fog';
import { leaveStump } from '../src/forest';
import { tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { canMark } from '../src/marks';
import { deserialize, serialize } from '../src/save';
import { sentStaticLayers, staticPatch } from '../src/snapshot';
import type { GameState, Tile } from '../src/state';
import { content, run, runUntil, totalLogs } from './helpers';

/**
 * Two trees and a woodcutter's hut (door (1,3), yard (2,2)): tree (5,1) is the nearer, (6,2) the
 * farther. A carrier keeps the hut's yard drained.
 */
const grove: MapDef = {
  name: 'grove',
  rows: ['........', '.....T..', '......T.', '........', '........', '........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 2 }],
  villagers: [{ job: 'carrier', x: 0, y: 5 }],
};

function objectAt(s: GameState, x: number, y: number): number | undefined {
  return idsOf(s.components.mapObject).find((id) => {
    const t = s.components.tile[id];
    return t?.x === x && t.y === y;
  });
}

function woodcutterTask(s: GameState) {
  const id = idsOf(s.components.woodcutter)[0] as number;
  return s.components.woodcutter[id];
}

function fell(from: Tile, to: Tile = from): Command {
  return { type: 'markTrees', from, to };
}

function dig(from: Tile, to: Tile = from): Command {
  return { type: 'markStumps', from, to };
}

function keep(from: Tile, to: Tile = from): Command {
  return { type: 'paintReserve', from, to };
}

describe('Fell marks', () => {
  it('a woodcutter fells a marked tree before a nearer unmarked one', () => {
    const s0 = createInitialState(1, grove, content);
    const near = objectAt(s0, 5, 1) as number;
    const far = objectAt(s0, 6, 2) as number;
    const s1 = run(s0, 1, { 0: [fell({ x: 6, y: 2 })] });
    expect(s1.components.mapObject[far]?.marked).toBe(true);
    expect(woodcutterTask(s1)).toEqual({ kind: 'toTree', tree: far });

    const felled = runUntil(s1, (s) => s.components.mapObject[far]?.type === 'stump', 5000);
    expect(felled.components.mapObject[near]).toMatchObject({ type: 'tree', amount: 3 });
    // The Stump it leaves isn't marked.
    expect(felled.components.mapObject[far]?.marked).toBeUndefined();
  });

  it('Keep still protects: a tree in a Reserve is never marked, and Keep takes marks off', () => {
    const s0 = createInitialState(1, grove, content);
    const near = objectAt(s0, 5, 1) as number;
    const far = objectAt(s0, 6, 2) as number;
    // Painted into a Reserve, the near tree refuses the mark; the far one takes it.
    const kept = run(s0, 1, { 0: [keep({ x: 5, y: 1 }), fell({ x: 4, y: 0 }, { x: 7, y: 3 })] });
    expect(kept.components.mapObject[near]?.marked).toBeUndefined();
    expect(kept.components.mapObject[far]?.marked).toBe(true);
    // Keep painted over a marked tree takes the mark off, and the woodcutter leaves it standing.
    const both = run(kept, 1, { [kept.tick]: [keep({ x: 6, y: 2 })] });
    expect(both.components.mapObject[far]?.marked).toBeUndefined();
    const later = run(both, 3000);
    expect(later.components.mapObject[near]).toMatchObject({ type: 'tree', amount: 3 });
    expect(later.components.mapObject[far]).toMatchObject({ type: 'tree', amount: 3 });
  });

  it('is painted only where every tile is Revealed, and cleared even in the Fog', () => {
    const s = createInitialState(1, grove, content);
    const far = objectAt(s, 6, 2) as number;
    s.fog = true;
    s.map.revealed = noTiles(s.map);
    for (let x = 0; x <= 6; x++) setTile(s.map.revealed, tileIndex(s.map, x, 2));
    expect(canMark(s, { x: 6, y: 2 }, { x: 6, y: 1 })).toBe(false);
    const refused = run(s, 1, { 0: [fell({ x: 6, y: 2 }, { x: 6, y: 1 })] });
    expect(refused.components.mapObject[far]?.marked).toBeUndefined();
    const marked = run(refused, 1, { 1: [fell({ x: 6, y: 2 })] });
    expect(marked.components.mapObject[far]?.marked).toBe(true);
    const cleared = run(marked, 1, {
      2: [{ type: 'clearMarks', from: { x: 0, y: 0 }, to: { x: 7, y: 5 } }],
    });
    expect(cleared.components.mapObject[far]?.marked).toBeUndefined();
  });

  it('goes to the client in a static patch: just the marked tree', () => {
    const s0 = createInitialState(1, grove, content);
    const far = objectAt(s0, 6, 2) as number;
    const sent = sentStaticLayers(s0);
    const s1 = run(s0, 1, { 0: [fell({ x: 6, y: 2 })] });
    expect(s1.staticVersion).toBeGreaterThan(s0.staticVersion);
    const patch = staticPatch(sent, s1);
    expect(Object.keys(patch.mapObject)).toEqual([String(far)]);
    expect(patch.mapObject[far]?.marked).toBe(true);
  });
});

describe('Dig marks', () => {
  /** The grove with its far tree (6,2) already felled to a Stump, and the near one in a Reserve. */
  function stumpGrove() {
    const s = createInitialState(1, grove, content);
    const stump = objectAt(s, 6, 2) as number;
    leaveStump(s, content, stump);
    return { s: run(s, 1, { 0: [keep({ x: 5, y: 1 })] }), stump };
  }

  it('a woodcutter digs out a marked Stump for 1 log, and it never sprouts', () => {
    const { s, stump } = stumpGrove();
    // Unmarked, nobody touches it.
    const left = run(s, 1000);
    expect(left.components.mapObject[stump]?.type).toBe('stump');
    expect(woodcutterTask(left)?.kind).toBe('idle');

    const marked = run(left, 1, { [left.tick]: [dig({ x: 6, y: 2 })] });
    expect(marked.components.mapObject[stump]?.marked).toBe(true);
    const dug = runUntil(marked, (x) => x.components.mapObject[stump] === undefined, 2000);
    expect(dug.components.mapObject[stump]).toBeUndefined();
    const home = runUntil(dug, (x) => woodcutterTask(x)?.kind === 'idle', 1000);
    expect(totalLogs(home)).toBe(1 + 3); // the dug-out log, and the reserved tree's 3
    // Long past the day a Stump would have sprouted, the tile is still bare.
    const year = run(home, 21 * content.calendar.dayTicks);
    expect(objectAt(year, 6, 2)).toBeUndefined();
  });

  it('a Stump takes only a Dig mark, and a tree only a Fell mark', () => {
    const { s, stump } = stumpGrove();
    const felled = run(s, 1, { [s.tick]: [fell({ x: 6, y: 2 })] });
    expect(felled.components.mapObject[stump]?.marked).toBeUndefined();
    const near = objectAt(s, 5, 1) as number;
    const s2 = run(s, 1, {
      [s.tick]: [
        { type: 'eraseReserve', from: { x: 5, y: 1 }, to: { x: 5, y: 1 } },
        dig({ x: 5, y: 1 }),
      ],
    });
    expect(s2.components.mapObject[near]?.marked).toBeUndefined();
  });

  it('marks survive save and load, and the loaded game carries on as an unbroken one', () => {
    const { s, stump } = stumpGrove();
    const mid = run(s, 50, { [s.tick]: [dig({ x: 6, y: 2 })] });
    expect(mid.components.mapObject[stump]?.marked).toBe(true);
    const loaded = deserialize(serialize(mid), content);
    expect(loaded.components.mapObject[stump]?.marked).toBe(true);
    expect(run(loaded, 1500)).toEqual(run(mid, 1500));
  });
});
