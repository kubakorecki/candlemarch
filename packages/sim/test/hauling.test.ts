import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { content, run, runUntil, totalLogs, woodcuttersHutStock } from './helpers';

const TOTAL = 17 * 3;

function carrier(s: GameState) {
  const id = idsOf(s.components.villager).find(
    (v) => s.components.villager[v]?.job === 'carrier',
  ) as number;
  return { id, villager: s.components.villager[id], haul: s.logistics.hauls[id] };
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
    expect(carrier(s).haul?.phase).toBe('dropoff');

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
      (st) => carrier(st).haul !== undefined,
      2000,
      place,
    );
    const [older] = idsOf(s.components.site);
    expect(carrier(s).haul?.to).toBe(older);
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
      (st) => carrier(st).haul === undefined && !st.components.path[carrier(st).id],
      1000,
    );

    expect(carrier(returned).villager?.carrying).toBeNull();
    // The log came back; the woodcutter may have added more, and nothing else takes any.
    expect(woodcuttersHutStock(returned)).toBeGreaterThanOrEqual(bufferBefore + 1);
    // Every log is accounted for except those already delivered to the cancelled site.
    expect(totalLogs(returned)).toBe(TOTAL - lost);
    // With no site left, the carrier stays idle.
    const later = run(returned, 200);
    expect(carrier(later).haul).toBeUndefined();
  });
});

describe('hauling on roads (job dispatch)', () => {
  // Woodcutter's hut at (0,0) with its door at (1,2); no trees, so its buffer is stocked by hand.
  const lane: MapDef = {
    name: 'lane',
    rows: Array(6).fill('............'),
    buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
    villagers: [{ job: 'carrier', x: 1, y: 2 }],
  };
  // A hut site at (10,1), so its door is (10,2): 9 tiles straight along row 2 from the source.
  const placeSite: Command = { type: 'placeBuilding', building: 'hut', x: 10, y: 1 };
  // A U-shaped road between the two doors, dipping down to row 4.
  const layRoad: Command[] = [
    { type: 'layPath', from: { x: 1, y: 2 }, to: { x: 1, y: 4 } },
    { type: 'layPath', from: { x: 1, y: 4 }, to: { x: 10, y: 2 } },
  ];

  /** Tiles the carrier walks to deliver its first log, as space-separated "x,y". */
  function deliveryRoute(commands: Command[]): string {
    const s0 = createInitialState(1, lane, content);
    const hut = idsOf(s0.components.building)[0] as number;
    s0.components.building[hut] = {
      type: 'woodcutters_hut',
      stock: { logs: 4 },
      input: {},
      workerLimit: 1,
    };
    const s = runUntil(s0, (st) => carrier(st).haul?.phase === 'dropoff', 100, { 0: commands });
    const path = s.components.path[carrier(s).id];
    return (path?.tiles ?? [])
      .map((i) => `${i % s.map.width},${Math.floor(i / s.map.width)}`)
      .join(' ');
  }

  it('goes straight without a road', () => {
    expect(deliveryRoute([placeSite])).toBe('2,2 3,2 4,2 5,2 6,2 7,2 8,2 9,2 10,2');
  });

  it('takes a road that is longer in tiles but faster', () => {
    // 11 tiles costing 666 + 942 + 7 × 666 + 942 + 666 = 7878, against 9000 straight.
    expect(deliveryRoute([placeSite, ...layRoad])).toBe(
      '1,3 2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,3 10,2',
    );
  });
});
