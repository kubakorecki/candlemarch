import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { heroOf, heroOrderAt } from '../src/hero';
import { listDemands, listSupplies } from '../src/logistics/supplyDemand';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, StockpileComponent } from '../src/state';
import { step } from '../src/step';
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

const CAP = content.logistics.yardCapacity;
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

  it('waits while the input buffer is empty, and starts once logs arrive', () => {
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

  it('stops while the yard has no room for a batch, and resumes when it has', () => {
    // Room for two batches of 2 in the yard; the third log waits.
    const s0 = yardWithLogs(3);
    const b0 = s0.components.building[blockOf(s0)];
    if (b0) b0.stock.firewood = CAP - 4;
    const full = run(s0, 400);
    expect(firewood(full)).toBe(CAP);
    expect(logsIn(full)).toBe(1);

    // Room for one batch again, as if a carrier took some.
    const block = full.components.building[blockOf(full)];
    if (block) block.stock.firewood = CAP - 2;
    const resumed = run(full, 100);
    expect(firewood(resumed)).toBe(CAP);
    expect(logsIn(resumed)).toBe(0);
  });

  it('asks for what its input buffer lacks, and offers what its output buffer holds', () => {
    const s = yardWithLogs(1);
    const block = blockOf(s);
    const tool = { target: block, kind: 'tools', resource: 'tools', amount: 1 };
    expect(listDemands(s, content)).toEqual([
      { target: block, kind: 'workshop', resource: 'logs', amount: 3 },
      tool,
    ]);
    expect(listSupplies(s, content)).toEqual([]);

    const split = run(s, 50);
    expect(listSupplies(split, content)).toEqual([
      { source: block, kind: 'building', resource: 'firewood', amount: 2 },
    ]);
    expect(listDemands(split, content)).toEqual([
      { target: block, kind: 'workshop', resource: 'logs', amount: 4 },
      tool,
    ]);
  });

  it('pauses while the village holds its standing order of firewood, and resumes below it', () => {
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
    // One batch of 2: its yard counts too, so 41 pauses it again with a log left.
    const resumed = run(paused, 100);
    expect(logsIn(resumed)).toBe(1);
    const piledNow = Object.values(
      resumed.components.stockpile[idsOf(resumed.components.stockpile)[0] as EntityId]?.goods ?? {},
    ).reduce((sum, g) => sum + g.amount, 0);
    const inHand = Object.values(resumed.components.villager).reduce(
      (sum, v) => sum + (v.carrying?.amount ?? 0),
      0,
    );
    expect(firewood(resumed) + inHand + piledNow).toBe(39 + 2);
  });
});

/**
 * A woodcutter's hut at (1,1) with 4 logs in its buffer and no trees, so they're all there is; a
 * chopping block at (6,0) with its door at (6,1); a 2×1 stockpile at (1,6); one carrier.
 */
const depot: MapDef = {
  name: 'depot',
  rows: Array(8).fill('..........'),
  buildings: [
    { type: 'woodcutters_hut', x: 1, y: 1 },
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
const SPLITTING_AT = 420;

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
      block.stock.firewood = CAP;
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

/**
 * A chopping block at (2,2) (door (2,3)), a woodcutter's hut at (6,0) (door (7,2)) with no trees,
 * one carrier, and the hero at (4,4) holding `inHand` logs.
 */
function workyard(inHand: number, hutLogs = 0): GameState {
  const map: MapDef = {
    name: 'workyard',
    rows: Array(7).fill('..........'),
    buildings: [
      { type: 'chopping_block', x: 2, y: 2 },
      { type: 'woodcutters_hut', x: 6, y: 0 },
    ],
    villagers: [{ job: 'carrier', x: 8, y: 5 }],
    hero: { x: 4, y: 4 },
  };
  const s = createInitialState(1, map, content);
  const id = heroOf(s) as EntityId;
  const h = s.components.hero[id];
  if (h && inHand > 0) h.carrying = { resource: 'logs', amount: inHand };
  const hut = idsOf(s.components.building).find(
    (b) => s.components.building[b]?.type === 'woodcutters_hut',
  );
  const b = hut === undefined ? undefined : s.components.building[hut];
  if (b) b.stock.logs = hutLogs;
  return s;
}

const heroCarrying = (s: GameState) => s.components.hero[heroOf(s) as EntityId]?.carrying ?? null;
const heroIdle = (s: GameState) =>
  s.tick > 0 && s.components.hero[heroOf(s) as EntityId]?.order === null;

describe('the hero feeding a workshop', () => {
  it('right-clicking a chopping block with logs in hand delivers them to its input buffer', () => {
    const s0 = workyard(5);
    const block = blockOf(s0);
    expect(heroOrderAt(s0, content, { x: 2, y: 2 })).toEqual({ order: 'deliver', target: block });

    const done = runUntil(s0, heroIdle, 500, {
      0: [{ type: 'orderHero', order: 'deliver', target: block }],
    });
    // The buffer holds 4; the hero keeps the fifth. The splitter may already have taken one.
    expect(logsIn(done) + firewood(done) / 2).toBe(4);
    expect(heroCarrying(done)).toEqual({ resource: 'logs', amount: 1 });
  });

  it('takes no delivery order for a paused workshop or a full input buffer', () => {
    const full = workyard(3);
    const b = full.components.building[blockOf(full)];
    if (b) b.input.logs = 4;
    expect(heroOrderAt(full, content, { x: 2, y: 2 })).toBeNull();
    const after = run(full, 1, {
      0: [{ type: 'orderHero', order: 'deliver', target: blockOf(full) }],
    });
    expect(after.components.hero[heroOf(after) as EntityId]?.order).toBeNull();

    const paused = createInitialState(
      1,
      { ...yard, stockpiles: [{ x: 0, y: 5, w: 5, h: 1 }], hero: { x: 5, y: 4 } },
      content,
    );
    const pile = paused.components.stockpile[idsOf(paused.components.stockpile)[0] as EntityId];
    for (let x = 0; x < 5; x++) {
      (pile as StockpileComponent).goods[5 * 8 + x] = { resource: 'firewood', amount: 8 };
    }
    const h = paused.components.hero[heroOf(paused) as EntityId];
    if (h) h.carrying = { resource: 'logs', amount: 3 };
    expect(heroOrderAt(paused, content, { x: 2, y: 2 })).toBeNull();
  });

  it("carriers count the hero's promise, and bring nothing it covers", () => {
    // The hero promises all 4 the buffer holds; the hut has logs a carrier could bring.
    let s = workyard(4, 4);
    const block = blockOf(s);
    const order = [{ type: 'orderHero' as const, order: 'deliver' as const, target: block }];
    s = step(s, order, content);
    while (!heroIdle(s)) {
      expect(Object.values(s.logistics.hauls).filter((h) => h.to === block)).toEqual([]);
      s = step(s, [], content);
    }
    expect(heroCarrying(s)).toBeNull();
    expect(logsIn(s) + firewood(s) / 2).toBe(4);
  });
});
