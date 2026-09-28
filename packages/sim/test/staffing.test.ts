import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState } from '../src/state';
import { openPositions } from '../src/systems/staffing';
import { content, run, runUntil } from './helpers';

// Woodcutter's hut at (0,0) with its door at (1,2), trees down the east edge, one carrier.
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 8 }, (_, y) => (y < 4 ? '...........T' : '............')),
  buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
  villagers: [{ job: 'carrier', x: 1, y: 3 }],
};

/** The camp with `logs` in the starting hut's buffer. */
function stocked(logs: number): GameState {
  const s = createInitialState(1, camp, content);
  const hut = idsOf(s.components.building)[0] as number;
  s.components.building[hut] = {
    type: 'woodcutters_hut',
    rotation: 0,
    stock: { logs },
    input: {},
    workerLimit: 1,
    cold: false,
  };
  return s;
}

// A woodcutter's hut site at (8,4), with its door at (9,6).
const placeHut: Command = { type: 'placeBuilding', building: 'woodcutters_hut', x: 8, y: 4 };

/** The first building placed by the player, once it's finished. */
function newHut(s: GameState): number | undefined {
  return idsOf(s.components.building)[1];
}

describe('placed workplaces', () => {
  it('get built, draft the idle carrier, and start producing', () => {
    const s0 = stocked(6);
    const carrier = idsOf(s0.components.villager).find(
      (v) => s0.components.villager[v]?.job === 'carrier',
    ) as number;

    const built = runUntil(s0, (s) => newHut(s) !== undefined, 3000, { 0: [placeHut] });
    const hut = newHut(built) as number;
    expect(built.components.building[hut]?.type).toBe('woodcutters_hut');
    // Drafted the tick the hut was finished.
    expect(built.components.villager[carrier]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(built.components.woodcutter[carrier]).toBeDefined();
    expect(openPositions(built, content, hut)).toEqual([]);

    const producing = runUntil(
      built,
      (s) => (s.components.building[hut]?.stock.logs ?? 0) > 0,
      1000,
    );
    expect(producing.components.building[hut]?.stock.logs).toBe(1);
  });

  it('wait for a carrier to finish its haul before drafting it', () => {
    // Plenty of logs and a far stockpile keep the carrier busy once the site has its logs.
    const s0 = stocked(20);
    const carrier = idsOf(s0.components.villager).find(
      (v) => s0.components.villager[v]?.job === 'carrier',
    ) as number;
    const commands = { 0: [placeHut, { type: 'placeStockpile', x: 0, y: 7, w: 1, h: 1 } as const] };

    const built = runUntil(s0, (s) => newHut(s) !== undefined, 3000, commands);
    const hut = newHut(built) as number;
    expect(built.logistics.hauls[carrier]).toBeDefined();
    expect(built.components.villager[carrier]?.job).toBe('carrier');
    expect(openPositions(built, content, hut)).toEqual(['woodcutter']);

    // The position stays open while the carrier hauls, and is filled on the tick the haul ends.
    let s = built;
    for (let i = 0; i < 1000 && s.logistics.hauls[carrier]; i++) {
      expect(openPositions(s, content, hut)).toEqual(['woodcutter']);
      s = run(s, 1);
    }
    expect(s.logistics.hauls[carrier]).toBeUndefined();
    expect(s.components.villager[carrier]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(openPositions(s, content, hut)).toEqual([]);
  });

  it('draft the lowest-ID idle carrier', () => {
    const twoCarriers: MapDef = {
      ...camp,
      villagers: [...camp.villagers, { job: 'carrier', x: 4, y: 7 }],
    };
    const s0 = createInitialState(1, twoCarriers, content);
    const hutId = idsOf(s0.components.building)[0] as number;
    s0.components.building[hutId] = {
      type: 'woodcutters_hut',
      rotation: 0,
      stock: { logs: 6 },
      input: {},
      workerLimit: 1,
      cold: false,
    };
    const [first, second] = idsOf(s0.components.villager).filter(
      (v) => s0.components.villager[v]?.job === 'carrier',
    ) as [number, number];

    const built = runUntil(s0, (s) => newHut(s) !== undefined, 3000, { 0: [placeHut] });
    const hut = newHut(built) as number;
    expect(built.logistics.hauls).toEqual({}); // both carriers are idle
    expect(built.components.villager[first]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(built.components.villager[second]).toMatchObject({ job: 'carrier', workplace: null });
  });

  it('leave the starting map staffed by its own workers', () => {
    const s = createInitialState(1, camp, content);
    const hut = idsOf(s.components.building)[0] as number;
    expect(openPositions(s, content, hut)).toEqual([]);
  });
});
