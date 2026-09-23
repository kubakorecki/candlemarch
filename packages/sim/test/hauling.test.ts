import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { content, run, runUntil, totalLogs, woodcuttersHutStock } from './helpers';

const TOTAL = 17 * 3;

function carrier(s: GameState) {
  const id = idsOf(s.components.villager).find(
    (v) => s.components.villager[v]?.role === 'carrier',
  ) as number;
  return { id, villager: s.components.villager[id], job: s.logistics.jobs[id] };
}

describe('hauling (job dispatch)', () => {
  it('moves logs from the woodcutter hut buffer to a site, one per trip', () => {
    const place: Record<number, Command[]> = {
      0: [{ type: 'placeBuilding', building: 'hut', x: 4, y: 16 }],
    };
    const s = runUntil(
      createInitialState(1, meadowMap, content),
      (st) => carrier(st).villager?.carrying !== null,
      2000,
      place,
    );
    expect(carrier(s).villager?.carrying).toEqual({ resource: 'logs', amount: 1 });
    expect(carrier(s).job?.phase).toBe('dropoff');

    const delivered = runUntil(
      s,
      (st) => {
        const site = Object.values(st.components.site)[0];
        return (site?.delivered.logs ?? 0) >= 1;
      },
      500,
    );
    expect(Object.values(delivered.components.site)[0]?.delivered.logs).toBe(1);
    expect(totalLogs(delivered)).toBe(TOTAL);
  });

  it('serves the oldest site first', () => {
    const place: Record<number, Command[]> = {
      0: [{ type: 'placeBuilding', building: 'hut', x: 4, y: 16 }],
      1: [{ type: 'placeBuilding', building: 'hut', x: 10, y: 16 }], // closer, but newer
    };
    const s = runUntil(
      createInitialState(1, meadowMap, content),
      (st) => carrier(st).job !== undefined,
      2000,
      place,
    );
    const [older] = idsOf(s.components.site);
    expect(carrier(s).job?.to).toBe(older);
  });

  it('cancelling a site mid-haul brings the log back to the buffer', () => {
    const place: Record<number, Command[]> = {
      0: [{ type: 'placeBuilding', building: 'hut', x: 4, y: 16 }],
    };
    const s0 = createInitialState(1, meadowMap, content);
    const carrying = runUntil(s0, (st) => carrier(st).villager?.carrying !== null, 2000, place);
    const siteId = idsOf(carrying.components.site)[0] as number;
    const lost = carrying.components.site[siteId]?.delivered.logs ?? 0;
    const bufferBefore = woodcuttersHutStock(carrying);

    const cancelled = step(carrying, [{ type: 'cancelConstruction', siteId }], content);
    const returned = runUntil(
      cancelled,
      (st) => carrier(st).job === undefined && !st.components.path[carrier(st).id],
      1000,
    );

    expect(carrier(returned).villager?.carrying).toBeNull();
    // The log came back; the woodcutter may have added more, and nothing else takes any.
    expect(woodcuttersHutStock(returned)).toBeGreaterThanOrEqual(bufferBefore + 1);
    // Every log is accounted for except those already delivered to the cancelled site.
    expect(totalLogs(returned)).toBe(TOTAL - lost);
    // With no site left, the carrier stays idle.
    const later = run(returned, 200);
    expect(carrier(later).job).toBeUndefined();
  });
});
