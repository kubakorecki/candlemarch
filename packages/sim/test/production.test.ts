import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { listDemands, listSupplies } from '../src/logistics/supplyDemand';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, StockpileComponent } from '../src/state';
import { content, run, runUntil } from './helpers';

// A chopping block at (2,2) with its door at (2,3), and its woodsplitter.
const yard: MapDef = {
  name: 'yard',
  rows: Array(6).fill('........'),
  buildings: [{ type: 'chopping_block', x: 2, y: 2 }],
  villagers: [],
};

function blockOf(s: GameState): EntityId {
  return idsOf(s.components.building).find(
    (id) => s.components.building[id]?.type === 'chopping_block',
  ) as EntityId;
}

/** A fresh yard with `logs` in the chopping block's input buffer. */
function yardWithLogs(logs: number): GameState {
  const s = createInitialState(1, yard, content);
  const block = s.components.building[blockOf(s)];
  if (block) block.input.logs = logs;
  return s;
}

const firewood = (s: GameState) => s.components.building[blockOf(s)]?.stock.firewood ?? 0;
const logsIn = (s: GameState) => s.components.building[blockOf(s)]?.input.logs ?? 0;

describe('production', () => {
  it('splits one log from the input buffer into two firewood in the output buffer', () => {
    const s0 = yardWithLogs(1);
    const s1 = run(s0, 1);
    // The log is taken as the work starts.
    expect(logsIn(s1)).toBe(0);
    expect(firewood(s1)).toBe(0);

    const done = runUntil(s1, (s) => firewood(s) > 0, 200);
    // Started on tick 0; 40 ticks of work finish on tick 40, so the state after it is tick 41.
    expect(done.tick).toBe(41);
    expect(firewood(done)).toBe(2);
  });

  it('waits at the door while the input buffer is empty, and starts once logs arrive', () => {
    const waiting = run(yardWithLogs(0), 200);
    expect(firewood(waiting)).toBe(0);
    const splitter = idsOf(waiting.components.crafter)[0] as EntityId;
    expect(waiting.components.crafter[splitter]?.kind).toBe('idle');

    const block = waiting.components.building[blockOf(waiting)];
    if (block) block.input.logs = 1;
    const done = run(waiting, 100);
    expect(logsIn(done)).toBe(0);
    expect(firewood(done)).toBe(2);
  });

  it('stops while the output buffer has no room for a batch, and resumes when it has', () => {
    // Capacity 4 holds two batches of 2; the third log waits.
    const full = run(yardWithLogs(3), 400);
    expect(firewood(full)).toBe(4);
    expect(logsIn(full)).toBe(1);

    // Room for one batch again, as if a carrier took some.
    const block = full.components.building[blockOf(full)];
    if (block) block.stock.firewood = 2;
    const resumed = run(full, 100);
    expect(firewood(resumed)).toBe(4);
    expect(logsIn(resumed)).toBe(0);
  });

  it('asks for what its input buffer lacks, and offers what its output buffer holds', () => {
    const s = yardWithLogs(1);
    const block = blockOf(s);
    expect(listDemands(s, content)).toEqual([
      { target: block, kind: 'workshop', resource: 'logs', amount: 3 },
    ]);
    expect(listSupplies(s, content)).toEqual([]);

    const split = run(s, 50);
    expect(listSupplies(split, content)).toEqual([
      { source: block, kind: 'building', resource: 'firewood', amount: 2 },
    ]);
    expect(listDemands(split, content)).toEqual([
      { target: block, kind: 'workshop', resource: 'logs', amount: 4 },
    ]);
  });

  it('pauses while the village holds the firewood target, and resumes below it', () => {
    // Five stockpile tiles of 8 hold exactly the target of 40.
    const s0 = createInitialState(
      1,
      { ...yard, stockpiles: [{ x: 0, y: 5, w: 5, h: 1 }] },
      content,
    );
    const pile = s0.components.stockpile[idsOf(s0.components.stockpile)[0] as EntityId];
    for (let x = 0; x < 5; x++) {
      (pile as StockpileComponent).goods[5 * 8 + x] = { resource: 'firewood', amount: 8 };
    }
    const block = s0.components.building[blockOf(s0)];
    if (block) block.input.logs = 2;

    const paused = run(s0, 200);
    expect(logsIn(paused)).toBe(2);
    expect(firewood(paused)).toBe(0);
    expect(listDemands(paused, content).filter((d) => d.kind === 'workshop')).toEqual([]);

    // One firewood burnt: 39 is below the target.
    const pileNow = paused.components.stockpile[idsOf(paused.components.stockpile)[0] as EntityId];
    const goods = pileNow?.goods[5 * 8];
    if (goods) goods.amount = 7;
    expect(listDemands(paused, content)).toContainEqual({
      target: blockOf(paused),
      kind: 'workshop',
      resource: 'logs',
      amount: 2,
    });
    const resumed = run(paused, 100);
    expect(logsIn(resumed)).toBe(0);
    expect(firewood(resumed)).toBe(4);
  });
});

/**
 * A woodcutter's hut at (0,0) with 4 logs in its buffer and no trees, so they're all there is; a
 * chopping block at (6,0) with its door at (6,1); a 2×1 stockpile at (1,6); one carrier.
 */
const depot: MapDef = {
  name: 'depot',
  rows: Array(8).fill('..........'),
  buildings: [
    { type: 'woodcutters_hut', x: 0, y: 0 },
    { type: 'chopping_block', x: 6, y: 0 },
  ],
  stockpiles: [{ x: 1, y: 6, w: 2, h: 1 }],
  villagers: [{ job: 'carrier', x: 3, y: 3 }],
};

function depotWithLogs(): GameState {
  const s = createInitialState(1, depot, content);
  const hut = idsOf(s.components.building).find(
    (id) => s.components.building[id]?.type === 'woodcutters_hut',
  );
  const b = hut === undefined ? undefined : s.components.building[hut];
  if (b) b.stock.logs = 4;
  return s;
}

const carrierHaul = (s: GameState) => {
  const id = idsOf(s.components.villager).find((v) => s.components.villager[v]?.job === 'carrier');
  return id === undefined ? undefined : s.logistics.hauls[id];
};

const onPile = (s: GameState, resource: 'logs' | 'firewood') =>
  Object.values(s.components.stockpile)
    .flatMap((p) => Object.values(p.goods))
    .reduce((n, g) => n + (g.resource === resource ? g.amount : 0), 0);

/** A tick of the depot run at which the woodsplitter is splitting a log. */
const SPLITTING_AT = 760;

describe('production logistics', () => {
  it('brings logs to a construction site before the chopping block', () => {
    const s0 = depotWithLogs();
    const place = { 0: [{ type: 'placeBuilding' as const, building: 'hut' as const, x: 5, y: 4 }] };
    const first = runUntil(s0, (s) => carrierHaul(s) !== undefined, 50, place);
    const site = idsOf(first.components.site)[0] as EntityId;
    expect(carrierHaul(first)?.to).toBe(site);

    // The hut needs 10, so every log goes to it.
    const end = run(first, 1500);
    expect(end.components.site[site]?.delivered.logs).toBe(4);
    expect(logsIn(end)).toBe(0);
    expect(firewood(end)).toBe(0);
  });

  it('brings logs to the chopping block before a stockpile, and stores the firewood', () => {
    const s0 = depotWithLogs();
    const first = runUntil(s0, (s) => carrierHaul(s) !== undefined, 50);
    expect(carrierHaul(first)?.to).toBe(blockOf(first));

    const end = run(first, 3000);
    expect(onPile(end, 'logs')).toBe(0);
    // 4 logs split into 8 firewood, all carried to the stockpile.
    expect(onPile(end, 'firewood')).toBe(8);
    expect(firewood(end)).toBe(0);
  });

  it('sends logs to a stockpile once the chopping block has no room for them', () => {
    const s0 = depotWithLogs();
    const block = s0.components.building[blockOf(s0)];
    if (block) {
      block.input.logs = 4;
      block.stock.firewood = 4;
    }
    const first = runUntil(s0, (s) => carrierHaul(s) !== undefined, 50);
    const pile = idsOf(first.components.stockpile)[0];
    // Logs come before firewood in content order, and neither goes to the full block.
    expect(carrierHaul(first)).toMatchObject({ resource: 'logs', to: pile });
  });

  it('is deterministic', () => {
    const a = run(depotWithLogs(), 3000);
    const b = run(depotWithLogs(), 3000);
    expect(a).toEqual(b);
    expect(onPile(a, 'firewood')).toBe(8);
  });

  it.each([SPLITTING_AT, 1200])(
    'save and load at tick %i continues exactly as an uninterrupted run',
    (at) => {
      const straight = run(depotWithLogs(), 3000);
      const saved = run(depotWithLogs(), at);
      const resumed = run(deserialize(serialize(saved), content), 3000 - at);
      expect(resumed).toEqual(straight);
    },
  );

  it(`is mid-split at tick ${SPLITTING_AT}, so the save test saves work in progress`, () => {
    const s = run(depotWithLogs(), SPLITTING_AT);
    expect(Object.values(s.components.crafter).map((t) => t.kind)).toEqual(['working']);
  });

  it('a placed chopping block is built and a carrier becomes its woodsplitter', () => {
    const s0 = depotWithLogs();
    const place = {
      0: [{ type: 'placeBuilding' as const, building: 'chopping_block' as const, x: 5, y: 4 }],
    };
    const end = run(s0, 3000, place);
    expect(idsOf(end.components.site)).toEqual([]);
    const blocks = idsOf(end.components.building).filter(
      (id) => end.components.building[id]?.type === 'chopping_block',
    );
    expect(blocks).toHaveLength(2);
    const newBlock = blocks[1] as EntityId;
    const splitters = idsOf(end.components.villager).filter(
      (id) => end.components.villager[id]?.workplace === newBlock,
    );
    expect(splitters).toHaveLength(1);
    const splitter = splitters[0] as EntityId;
    expect(end.components.villager[splitter]?.job).toBe('woodsplitter');
    expect(end.components.crafter[splitter]).toBeDefined();
  });
});
