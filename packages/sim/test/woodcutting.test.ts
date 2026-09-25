import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { haulsOf } from '../src/logistics/jobDispatch';
import { createInitialState, type MapDef } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import type { GameState } from '../src/state';
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
  for (const task of Object.values(copy.components.woodcutter)) {
    if (task.kind === 'idle') task.retryAt = 0;
  }
  return copy;
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

  it('takes the nearest tree first and removes it once empty', () => {
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

    const emptied = runUntil(s1, (s) => !s.components.mapObject[target], 5000);
    expect(emptied.components.mapObject[target]).toBeUndefined();
    expect(emptied.components.tile[target]).toBeUndefined();
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
        idsOf(s.components.mapObject).length === 0 &&
        Object.values(s.components.villager).every((v) => v.carrying === null) &&
        idsOf(haulsOf(s)).length === 0 &&
        idsOf(s.components.path).length === 0,
      5000,
      placeHut,
    );

    expect(idsOf(done.components.mapObject)).toHaveLength(0);
    expect(totalLogs(done)).toBe(6);
    const siteId = idsOf(done.components.site)[0] as number;
    expect(done.components.site[siteId]?.delivered.logs).toBe(6);
    expect(woodcutter(done).task?.kind).toBe('idle');

    // Nothing else happens afterwards: no crash, no wandering, no phantom logs.
    const later = run(done, 500);
    expect(settled(later)).toEqual(settled(done));
  });
});
