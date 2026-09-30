import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { entityLayout } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import type { GameState, Rotation } from '../src/state';
import { content, run, runUntil, totalLogs, woodcuttersHutStock } from './helpers';

/** Two trees (6 logs), a woodcutter's hut and a carrier. */
const grove: MapDef = {
  name: 'grove',
  rows: ['........', '.....T..', '......T.', '........', '........', '........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 2 }],
  villagers: [{ job: 'carrier', x: 0, y: 5 }],
};

function woodcutter(s: GameState) {
  const id = idsOf(s.components.woodcutter)[0] as number;
  return { id, task: s.components.woodcutter[id], villager: s.components.villager[id] };
}

/** State with the parts that may legitimately tick over while idle blanked out. */
function settled(s: GameState): unknown {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  copy.tick = 0;
  copy.traffic = []; // counts time passing, like `tick`
  for (const task of Object.values(copy.components.woodcutter)) {
    if (task.kind === 'idle') task.retryAt = 0;
  }
  return copy;
}

/** Trees still standing (felled ones are Stumps). */
function treesLeft(s: GameState): number {
  return Object.values(s.components.mapObject).filter((o) => o.type === 'tree').length;
}

describe('woodcutting', () => {
  it('fills the output buffer up to its capacity, then waits', () => {
    // No construction site, so nothing takes logs away.
    const end = run(createInitialState(1, meadowMap, content), 2000);
    expect(woodcuttersHutStock(end)).toBe(4);
    const w = woodcutter(end);
    expect(w.task?.kind).toBe('idle');
    expect(w.villager?.carrying).toBeNull();
    expect(totalLogs(end)).toBe(17 * 3);
  });

  it('takes the nearest tree first and fells it to a Stump once empty', () => {
    const s0 = createInitialState(1, grove, content);
    // From the door (2,4): tree (5,1) is 3 diagonals = 4242 units; tree (6,2) is 4828.
    const nearest = idsOf(s0.components.mapObject).find((id) => {
      const t = s0.components.tile[id];
      return t?.x === 5 && t.y === 1;
    });
    const s1 = run(s0, 1);
    const w = woodcutter(s1);
    expect(w.task).toEqual({ kind: 'toTree', tree: nearest });
    const target = nearest as number;

    const emptied = runUntil(s1, (s) => s.components.mapObject[target]?.type !== 'tree', 5000);
    expect(emptied.components.mapObject[target]).toMatchObject({ type: 'stump', amount: 0 });
    expect(emptied.components.tile[target]).toEqual({ x: 5, y: 1 });
  });

  it('stops cleanly when all trees are gone', () => {
    // A hut costs 10 logs but the grove has only 6, so the carrier keeps the buffer drained.
    const placeHut: Record<number, Command[]> = {
      0: [{ type: 'placeBuilding', building: 'hut', x: 5, y: 4 }],
    };
    const s0 = createInitialState(1, grove, content);
    const done = runUntil(
      s0,
      (s) =>
        treesLeft(s) === 0 &&
        Object.values(s.components.villager).every((v) => v.carrying === null) &&
        idsOf(s.logistics.hauls).length === 0 &&
        idsOf(s.components.path).length === 0,
      5000,
      placeHut,
    );

    expect(treesLeft(done)).toBe(0);
    expect(totalLogs(done)).toBe(6);
    const siteId = idsOf(done.components.site)[0] as number;
    expect(done.components.site[siteId]?.delivered.logs).toBe(6);
    expect(woodcutter(done).task?.kind).toBe('idle');

    // Nothing else happens afterwards: no crash, no wandering, no phantom logs.
    const later = run(done, 500);
    expect(settled(later)).toEqual(settled(done));
  });
});

describe("the woodcutter's hut", () => {
  /** Open meadow with trees in the corners, a Stockpile holding the hut's logs and one Carrier. */
  const clearing: MapDef = {
    name: 'clearing',
    rows: ['T.........T', ...Array(9).fill('...........'), 'T.........T'],
    stockpiles: [{ x: 0, y: 5, w: 1, h: 1, goods: [{ resource: 'logs', amount: 6 }] }],
    buildings: [],
    villagers: [{ job: 'carrier', x: 1, y: 5 }],
  };

  it('is one tile with its door straight ahead, on every turn, and works', () => {
    const doors: Record<Rotation, { x: number; y: number }> = {
      0: { x: 5, y: 6 },
      1: { x: 4, y: 5 },
      2: { x: 5, y: 4 },
      3: { x: 6, y: 5 },
    };
    for (const rotation of [0, 1, 2, 3] as const) {
      const place: Command = {
        type: 'placeBuilding',
        building: 'woodcutters_hut',
        x: 5,
        y: 5,
        rotation,
      };
      const s0 = run(createInitialState(1, clearing, content), 1, { 0: [place] });
      const site = idsOf(s0.components.site)[0] as number;
      expect(entityLayout(s0, content, site), `turn ${rotation}`).toMatchObject({
        tiles: [{ x: 5, y: 5 }],
        door: doors[rotation],
      });
      const working = runUntil(s0, (s) => woodcuttersHutStock(s) > 0, 5000);
      expect(woodcuttersHutStock(working), `turn ${rotation}`).toBeGreaterThan(0);
    }
  });
});
