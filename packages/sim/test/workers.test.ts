// The player takes villagers off Workplaces, moves them between Workplaces, and sets how many
// workers each one wants.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { step } from '../src/step';
import { openPositions } from '../src/systems/staffing';
import { maxWorkers, reassignTargets } from '../src/workers';
import { content, run, runUntil } from './helpers';

// A woodcutter's hut at (1,1) (door (1,2)), a chopping block at (4,0) (door (4,1)), trees down
// the east edge and one carrier.
const yard: MapDef = {
  name: 'yard',
  rows: Array.from({ length: 8 }, (_, y) => (y < 4 ? '.........T' : '..........')),
  buildings: [
    { type: 'woodcutters_hut', x: 1, y: 1 },
    { type: 'chopping_block', x: 4, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 2, y: 5 }],
};

/** Content whose woodcutter's hut employs three woodcutters. */
const bigHutContent: Content = {
  ...content,
  buildings: {
    ...content.buildings,
    woodcutters_hut: {
      ...content.buildings.woodcutters_hut,
      employs: [{ job: 'woodcutter', count: 3 }],
    },
  },
};

/** The yard's woodcutter's hut alone, for `bigHutContent`. */
const bigHutYard: MapDef = { ...yard, buildings: [{ type: 'woodcutters_hut', x: 1, y: 1 }] };

function buildingOf(s: GameState, type: string): EntityId {
  return idsOf(s.components.building).find(
    (id) => s.components.building[id]?.type === type,
  ) as EntityId;
}

function villagersWith(s: GameState, job: string): EntityId[] {
  return idsOf(s.components.villager).filter((id) => s.components.villager[id]?.job === job);
}

function setup() {
  const s = createInitialState(1, yard, content);
  return {
    s,
    hut: buildingOf(s, 'woodcutters_hut'),
    block: buildingOf(s, 'chopping_block'),
    woodcutter: villagersWith(s, 'woodcutter')[0] as EntityId,
    splitter: villagersWith(s, 'woodsplitter')[0] as EntityId,
    carrier: villagersWith(s, 'carrier')[0] as EntityId,
  };
}

const limitOf = (s: GameState, building: EntityId) => s.components.building[building]?.workerLimit;

describe('worker limit', () => {
  it('starts at the most the building employs', () => {
    const { s, hut, block } = setup();
    expect(limitOf(s, hut)).toBe(1);
    expect(limitOf(s, block)).toBe(1);
    expect(maxWorkers(bigHutContent, 'woodcutters_hut')).toBe(3);
    expect(maxWorkers(content, 'hut')).toBe(0);
  });

  it('is the most a finished building employs', () => {
    const { s } = setup();
    const placed = run(s, 1, {
      0: [{ type: 'placeBuilding', building: 'chopping_block', x: 6, y: 5 }],
    });
    const site = idsOf(placed.components.site)[0] as EntityId;
    placed.components.site[site] = {
      type: 'chopping_block',
      rotation: 0,
      delivered: { logs: 3 },
      buildProgress: 0,
    };
    const built = runUntil(placed, (x) => x.components.building[site] !== undefined, 500);
    expect(limitOf(built, site)).toBe(1);
  });
});

describe('unassignWorker', () => {
  it('makes the worker a Carrier, and staffing leaves them be', () => {
    const { s, hut, woodcutter } = setup();
    const s1 = run(s, 1, { 0: [{ type: 'unassignWorker', villager: woodcutter }] });
    expect(s1.components.villager[woodcutter]).toMatchObject({ job: 'carrier', workplace: null });
    expect(s1.components.woodcutter[woodcutter]).toBeUndefined();
    expect(limitOf(s1, hut)).toBe(0);
    expect(openPositions(s1, content, hut)).toEqual([]);

    const later = run(s1, 400);
    expect(later.components.villager[woodcutter]).toMatchObject({ job: 'carrier' });
    expect(villagersWith(later, 'woodcutter')).toEqual([]);
  });
});

describe('setWorkerLimit', () => {
  it('drafts an idle Carrier when raised', () => {
    const { s, hut, woodcutter } = setup();
    const off = run(s, 1, { 0: [{ type: 'unassignWorker', villager: woodcutter }] });
    expect(openPositions(off, content, hut)).toEqual([]);

    const on = run(off, 1, { 1: [{ type: 'setWorkerLimit', building: hut, limit: 1 }] });
    expect(limitOf(on, hut)).toBe(1);
    // The lowest-ID idle Carrier: the old woodcutter.
    expect(on.components.villager[woodcutter]).toMatchObject({ job: 'woodcutter', workplace: hut });
  });

  it('unassigns the highest-ID workers first when lowered below the number employed', () => {
    const s = createInitialState(1, bigHutYard, bigHutContent);
    const hut = buildingOf(s, 'woodcutters_hut');
    const [first, second, third] = villagersWith(s, 'woodcutter') as [number, number, number];
    expect(limitOf(s, hut)).toBe(3);

    const s1 = run(
      s,
      1,
      { 0: [{ type: 'setWorkerLimit', building: hut, limit: 1 }] },
      bigHutContent,
    );
    expect(limitOf(s1, hut)).toBe(1);
    expect(s1.components.villager[first]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(s1.components.villager[second]).toMatchObject({ job: 'carrier', workplace: null });
    expect(s1.components.villager[third]).toMatchObject({ job: 'carrier', workplace: null });
    expect(openPositions(s1, bigHutContent, hut)).toEqual([]);

    // Raising it again drafts one of them back, not both.
    const s2 = run(
      s1,
      1,
      { 1: [{ type: 'setWorkerLimit', building: hut, limit: 2 }] },
      bigHutContent,
    );
    expect(villagersWith(s2, 'woodcutter')).toHaveLength(2);
  });
});

describe('reassignWorker', () => {
  it('moves the worker and both limits, and nobody takes the old position', () => {
    const { s, hut, block, woodcutter, splitter, carrier } = setup();
    // Free the chopping block's position first.
    const s1 = run(s, 1, { 0: [{ type: 'unassignWorker', villager: splitter }] });
    expect(limitOf(s1, block)).toBe(0);
    expect(reassignTargets(s1, content, woodcutter)).toEqual([block]);

    const s2 = run(s1, 1, {
      1: [{ type: 'reassignWorker', villager: woodcutter, workplace: block }],
    });
    expect(s2.components.villager[woodcutter]).toMatchObject({
      job: 'woodsplitter',
      workplace: block,
    });
    expect(s2.components.crafter[woodcutter]).toBeDefined();
    expect(s2.components.woodcutter[woodcutter]).toBeUndefined();
    expect(limitOf(s2, block)).toBe(1);
    expect(limitOf(s2, hut)).toBe(0);

    // Two idle Carriers, and the hut drafts neither.
    const later = run(s2, 200);
    expect(later.components.villager[splitter]).toMatchObject({ job: 'carrier' });
    expect(later.components.villager[carrier]).toMatchObject({ job: 'carrier' });
    expect(openPositions(later, content, hut)).toEqual([]);
  });

  it('takes a Carrier onto a Workplace', () => {
    const { s, hut, woodcutter, carrier } = setup();
    const s1 = run(s, 1, { 0: [{ type: 'unassignWorker', villager: woodcutter }] });
    expect(reassignTargets(s1, content, carrier)).toEqual([hut]);

    const s2 = run(s1, 1, { 1: [{ type: 'reassignWorker', villager: carrier, workplace: hut }] });
    expect(s2.components.villager[carrier]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(s2.components.villager[woodcutter]).toMatchObject({ job: 'carrier' });
    expect(limitOf(s2, hut)).toBe(1);
  });

  it('raises the target limit only if it must', () => {
    const s = createInitialState(1, bigHutYard, bigHutContent);
    const hut = buildingOf(s, 'woodcutters_hut');
    const third = villagersWith(s, 'woodcutter')[2] as EntityId;
    // Limit 3 with two employed: the third position is open, but nobody is idle to fill it.
    const v = s.components.villager[third];
    if (v) Object.assign(v, { job: 'carrier', workplace: null });
    delete s.components.woodcutter[third];
    s.logistics.hauls[third] = { resource: 'logs', amount: 1, from: hut, to: hut, phase: 'pickup' };
    expect(openPositions(s, bigHutContent, hut)).toEqual(['woodcutter']);

    const s1 = run(
      s,
      1,
      { 0: [{ type: 'reassignWorker', villager: third, workplace: hut }] },
      bigHutContent,
    );
    expect(s1.components.villager[third]).toMatchObject({ job: 'woodcutter', workplace: hut });
    expect(limitOf(s1, hut)).toBe(3);
  });
});

describe('invalid worker commands', () => {
  it('are ignored', () => {
    const { s, hut, block, woodcutter, carrier } = setup();
    const site = run(s, 1, {
      0: [{ type: 'placeBuilding', building: 'hut', x: 6, y: 5 }],
    });
    const siteId = idsOf(site.components.site)[0] as EntityId;
    const invalid: Command[] = [
      { type: 'unassignWorker', villager: carrier }, // already a Carrier
      { type: 'unassignWorker', villager: 999 },
      { type: 'unassignWorker', villager: hut },
      { type: 'reassignWorker', villager: woodcutter, workplace: block }, // no free position
      { type: 'reassignWorker', villager: woodcutter, workplace: hut }, // already there
      { type: 'reassignWorker', villager: carrier, workplace: siteId },
      { type: 'reassignWorker', villager: 999, workplace: hut },
      { type: 'setWorkerLimit', building: hut, limit: -1 },
      { type: 'setWorkerLimit', building: hut, limit: 2 },
      { type: 'setWorkerLimit', building: hut, limit: 0.5 },
      { type: 'setWorkerLimit', building: hut, limit: Number.NaN },
      { type: 'setWorkerLimit', building: siteId, limit: 0 },
      { type: 'setWorkerLimit', building: 999, limit: 0 },
    ];
    for (const command of invalid) {
      expect(step(site, [command], content), JSON.stringify(command)).toEqual(
        step(site, [], content),
      );
    }
  });
});

describe('work in hand', () => {
  it('abandons a chop, and the tree keeps its logs', () => {
    const { s, woodcutter } = setup();
    const chopping = runUntil(
      s,
      (x) => x.components.woodcutter[woodcutter]?.kind === 'chopping',
      2000,
    );
    const task = chopping.components.woodcutter[woodcutter];
    if (task?.kind !== 'chopping') throw new Error('never started chopping');
    const logs = chopping.components.mapObject[task.tree]?.amount;

    const s1 = run(chopping, 1, {
      [chopping.tick]: [{ type: 'unassignWorker', villager: woodcutter }],
    });
    expect(s1.components.mapObject[task.tree]?.amount).toBe(logs);
    expect(s1.components.villager[woodcutter]?.carrying).toBeNull();
  });

  it('puts goods in hand in the old output buffer, even if that overfills it', () => {
    const { s, hut, woodcutter } = setup();
    const carrying = runUntil(s, (x) => x.components.villager[woodcutter]?.carrying != null, 2000);
    expect(carrying.components.woodcutter[woodcutter]?.kind).toBe('toHut');
    const building = carrying.components.building[hut];
    if (building) building.stock.logs = 4; // full

    const s1 = run(carrying, 1, {
      [carrying.tick]: [{ type: 'unassignWorker', villager: woodcutter }],
    });
    expect(s1.components.villager[woodcutter]?.carrying).toBeNull();
    expect(s1.components.building[hut]?.stock.logs).toBe(5);
    // Stops at the next tile rather than walking on to the hut.
    expect(s1.components.path[woodcutter]?.tiles.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('abandons a batch and puts its inputs back in the input buffer', () => {
    const { s, block, splitter } = setup();
    const b = s.components.building[block];
    if (b) b.input.logs = 1;
    const working = runUntil(s, (x) => x.components.crafter[splitter]?.kind === 'working', 200);
    expect(working.components.building[block]?.input.logs).toBe(0);

    const s1 = run(working, 1, {
      [working.tick]: [{ type: 'unassignWorker', villager: splitter }],
    });
    expect(s1.components.building[block]?.input.logs).toBe(1);
    expect(s1.components.building[block]?.stock.firewood ?? 0).toBe(0);
    expect(s1.components.crafter[splitter]).toBeUndefined();
  });

  it("returns a reassigned Carrier's goods to where they were picked up", () => {
    const { s, hut, woodcutter } = setup();
    // The woodcutter becomes a Carrier (the lowest-ID one) and hauls the hut's log to a stockpile.
    const b = s.components.building[hut];
    if (b) b.stock.logs = 1;
    const s1 = run(s, 1, {
      0: [
        { type: 'setWorkerLimit', building: hut, limit: 0 },
        { type: 'placeStockpile', x: 0, y: 7, w: 1, h: 1 },
      ],
    });
    const loaded = runUntil(s1, (x) => x.components.villager[woodcutter]?.carrying != null, 500);
    expect(loaded.logistics.hauls[woodcutter]?.phase).toBe('dropoff');
    expect(loaded.components.building[hut]?.stock.logs).toBe(0);

    const s2 = run(loaded, 1, {
      [loaded.tick]: [{ type: 'reassignWorker', villager: woodcutter, workplace: hut }],
    });
    expect(s2.logistics.hauls[woodcutter]).toBeUndefined();
    expect(s2.components.villager[woodcutter]).toMatchObject({
      job: 'woodcutter',
      workplace: hut,
      carrying: null,
    });
    expect(s2.components.building[hut]?.stock.logs).toBe(1);
  });
});

describe('determinism and save/load with worker limits', () => {
  const commands: Record<number, Command[]> = {};
  function scenario() {
    const { s, hut, block, woodcutter, splitter } = setup();
    Object.assign(commands, {
      10: [{ type: 'unassignWorker', villager: splitter }],
      50: [{ type: 'reassignWorker', villager: woodcutter, workplace: block }],
      300: [{ type: 'setWorkerLimit', building: hut, limit: 0 }],
    } satisfies Record<number, Command[]>);
    return { s, hut };
  }

  it('gives the same state from the same commands', () => {
    const { s } = scenario();
    expect(run(s, 800, commands)).toEqual(run(s, 800, commands));
  });

  it('continues a loaded game exactly, with a limit below the maximum', () => {
    const { s, hut } = scenario();
    const mid = run(s, 400, commands);
    expect(limitOf(mid, hut)).toBe(0);
    const loaded = deserialize(serialize(mid), content);
    expect(run(loaded, 400, commands)).toEqual(run(mid, 400, commands));
  });

  it('gives buildings saved before worker limits the maximum', () => {
    const { s } = setup();
    const data = JSON.parse(serialize(s));
    for (const b of Object.values(data.components.building) as Record<string, unknown>[]) {
      delete b.workerLimit;
    }
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });
});
