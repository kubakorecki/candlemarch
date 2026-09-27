// Spoilage: at each Dawn every stack of Food in a Granary or workplace buffer loses a share,
// rounded up (ADR-0002). Winter's cold slows it; Food in someone's hands doesn't spoil.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, ResourceAmounts } from '../src/state';
import { content, run } from './helpers';

/**
 * 10×7 with a river along row 3: a fisher's hut at (0,1) (door (0,2)), a Granary at (4,0)
 * (door (5,2)) and a chopping block at (8,0). No one else, so nobody eats.
 * IDs: fisher's hut 1, fisher 2, Granary 3, chopping block 4, woodsplitter 5.
 */
const store: MapDef = {
  name: 'store',
  rows: [
    '..........',
    '..........',
    '..........',
    '~~~~~~~~~~',
    '..........',
    '..........',
    '..........',
  ],
  buildings: [
    { type: 'fishers_hut', x: 0, y: 1 },
    { type: 'granary', x: 4, y: 0 },
    { type: 'chopping_block', x: 8, y: 0 },
  ],
  villagers: [],
};
const FISHERS_HUT = 1;
const FISHER = 2;
const GRANARY = 3;
const CHOPPING_BLOCK = 4;

/** Content where logs are a Food too, spoiling at 50% a day. */
const logsAreFood: Content = {
  ...content,
  resources: {
    ...content.resources,
    logs: { id: 'logs', name: 'Logs', storage: 'granary', spoilPercent: 50 },
  },
};

/** The store at Dawn of `day` with the Granary holding `stock`. Running 1 tick runs that Dawn. */
function dawnWith(day: number, stock: ResourceAmounts): GameState {
  const s = createInitialState(1, store, content);
  s.tick = dawnTick(day, content);
  const granary = s.components.building[GRANARY];
  if (granary) granary.stock = { ...stock };
  // The fisher stays out of it: no catch at the Dawn tick.
  const v = s.components.villager[FISHER];
  if (v) v.routine = 'asleep';
  return s;
}

const stockOf = (s: GameState, id: EntityId) => s.components.building[id]?.stock ?? {};

describe('spoilage at Dawn', () => {
  it('each stack loses its rate, rounded up', () => {
    // Fish: 25% a day. 10 × 25% = 2.5, so 3 go.
    const spoiled = run(dawnWith(2, { fish: 10 }), 1);
    expect(stockOf(spoiled, GRANARY).fish).toBe(7);
  });

  it('happens only at Dawn', () => {
    const s = dawnWith(2, { fish: 10 });
    s.tick += 1;
    expect(stockOf(run(s, 2000), GRANARY).fish).toBe(10); // before Dusk, so nobody eats
  });

  it("doesn't happen at the Dawn a game starts on", () => {
    expect(stockOf(run(dawnWith(1, { fish: 10 }), 1), GRANARY).fish).toBe(10);
  });

  it('different Foods spoil at different rates', () => {
    const spoiled = run(dawnWith(2, { fish: 10, logs: 10 }), 1, {}, logsAreFood);
    expect(stockOf(spoiled, GRANARY)).toEqual({ fish: 7, logs: 5 });
  });

  it('a stack of 1 goes', () => {
    expect(stockOf(run(dawnWith(2, { fish: 1 }), 1), GRANARY).fish).toBe(0);
  });

  it('is slower in winter', () => {
    // Winter is days 16 to 20. Fish: 25% × 20% = 5%; 10 × 5% = 0.5, so 1 goes.
    const spoiled = run(dawnWith(17, { fish: 10 }), 1);
    expect(stockOf(spoiled, GRANARY).fish).toBe(9);
    // A winter rate is truncated: 50% × 20% = 10%; 30 × 10% = 3.
    const logs = run(dawnWith(17, { logs: 30 }), 1, {}, logsAreFood);
    expect(stockOf(logs, GRANARY).logs).toBe(27);
  });

  it('takes Food in workplace output and input buffers too, but nothing else', () => {
    const s = dawnWith(2, {});
    const hut = s.components.building[FISHERS_HUT];
    if (hut) hut.stock = { fish: 4 };
    const block = s.components.building[CHOPPING_BLOCK];
    if (block) {
      block.input = { logs: 4 };
      block.stock = { firewood: 4 };
    }
    const spoiled = run(s, 1, {}, logsAreFood);
    expect(stockOf(spoiled, FISHERS_HUT).fish).toBe(3);
    expect(spoiled.components.building[CHOPPING_BLOCK]?.input.logs).toBe(2);
    expect(stockOf(spoiled, CHOPPING_BLOCK).firewood).toBe(4);
  });

  it("doesn't take Food in a villager's or the hero's hands", () => {
    const s = createInitialState(
      1,
      { ...store, villagers: [{ job: 'carrier', x: 7, y: 5 }], hero: { x: 8, y: 5 } },
      content,
    );
    s.tick = dawnTick(2, content);
    // IDs: ..., woodsplitter 5, Carrier 6, hero 7.
    const carrier = s.components.villager[6];
    if (carrier) carrier.carrying = { resource: 'fish', amount: 3 };
    const hero = s.components.hero[7];
    if (hero) hero.carrying = { resource: 'fish', amount: 3 };
    const later = run(s, 1);
    expect(later.components.villager[6]?.carrying).toEqual({ resource: 'fish', amount: 3 });
    expect(later.components.hero[7]?.carrying).toEqual({ resource: 'fish', amount: 3 });
  });
});

describe('the eating order', () => {
  it('is the fastest-spoiling Food first', () => {
    // Logs spoil at 50%, fish at 25%: the first to eat takes the log, though 'fish' sorts first.
    const s = createInitialState(1, store, content);
    s.tick = duskTick(1, content);
    const granary = s.components.building[GRANARY];
    if (granary) granary.stock = { fish: 2, logs: 1 };
    const fed = run(s, 300, {}, logsAreFood);
    for (const id of idsOf(fed.components.villager)) {
      expect(fed.components.villager[id]?.missedMeals).toBe(0);
    }
    expect(stockOf(fed, GRANARY)).toEqual({ fish: 1, logs: 0 });
  });
});

describe('days of spoilage', () => {
  // The fisher catches, a Carrier hauls fish to the Granary, and it spoils each Dawn.
  const map: MapDef = { ...store, villagers: [{ job: 'carrier', x: 7, y: 1 }] };
  const script = (): GameState => {
    const s = createInitialState(1, map, content);
    const granary = s.components.building[GRANARY];
    if (granary) granary.stock = { fish: 20 };
    return s;
  };
  const DAYS = 3 * content.calendar.dayTicks + 10;

  it('are deterministic', () => {
    const a = run(script(), DAYS);
    expect(a).toEqual(run(script(), DAYS));
    expect(idsOf(a.components.villager)).toHaveLength(3);
  });

  it('saved and loaded between Dawns, continue like an uninterrupted run', () => {
    const uninterrupted = run(script(), DAYS);
    const mid = run(script(), dawnTick(2, content) + 500);
    expect(run(deserialize(serialize(mid), content), DAYS - mid.tick)).toEqual(uninterrupted);
  });
});
