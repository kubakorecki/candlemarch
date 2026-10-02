// Delivery orders (spec, Trades and masters: Side quests in M5): the notice board posts one at a
// time, a good the village can make, an amount, a deadline and a coin reward. Once accepted,
// Carriers bring the goods to the trade post; filled, it pays its reward; unfilled, it fails at its
// deadline. The next one is posted a few days after the last closes.
import type { Content, DeliveryOrderDef } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { createInitialState, type MapDef } from '../src/map';
import { postings } from '../src/noticeBoard';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { amountOnTile } from '../src/stockpiles';
import { COIN } from '../src/treasury';
import { content, run } from './helpers';

const DAY = content.calendar.dayTicks;

/**
 * 12×8 Meadow: a trade post 1 at (1,1), a notice board 2 at (9,1), a woodcutter's hut 3 at (5,1)
 * with its woodcutter 4 and no trees (so the village makes logs), a Stockpile 5 with 20 logs and
 * two Carriers 6 and 7.
 */
const yard: MapDef = {
  name: 'yard',
  rows: Array.from({ length: 8 }, () => '............'),
  buildings: [
    { type: 'trade_post', x: 1, y: 1 },
    { type: 'notice_board', x: 9, y: 1 },
    { type: 'woodcutters_hut', x: 5, y: 1 },
  ],
  stockpiles: [{ x: 6, y: 5, w: 2, h: 2, goods: [{ resource: 'logs', amount: 20 }] }],
  villagers: [
    { job: 'carrier', x: 3, y: 6 },
    { job: 'carrier', x: 4, y: 6 },
  ],
};
const POST = 1;

/**
 * Content whose only Delivery order is `orders` (10 logs within 3 days for 50 coin unless given),
 * and no Charters.
 */
function only(...orders: DeliveryOrderDef[]): Content {
  const logs = { resource: 'logs' as const, amount: 10, days: 3, reward: 50 };
  return {
    ...content,
    deliveries: { ...content.deliveries, orders: orders.length > 0 ? orders : [logs] },
    charters: { ...content.charters, offers: {} },
  };
}
const LOGS = only();

function village(map: MapDef = yard): GameState {
  const s = createInitialState(1, map, content);
  s.rank = 'hamlet';
  return s;
}

/** Steps `s` until `done` or `max` ticks, with the commands at their ticks and content `c`. */
function until(
  s: GameState,
  done: (x: GameState) => boolean,
  max: number,
  c: Content,
  commandsAt: Record<number, Command[]> = {},
): GameState {
  let x = s;
  for (let i = 0; i < max && !done(x); i++) x = step(x, commandsAt[x.tick] ?? [], c);
  return x;
}

/** Logs on every Stockpile. */
function piledLogs(s: GameState): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), 'logs');
  }
  return total;
}

const accept = (posting: number): Command => ({ type: 'acceptPosting', posting });

describe('Delivery orders', () => {
  it('one is posted at a Dawn: a good the village makes, an amount, a deadline and a reward', () => {
    const s = run(village(), 1, {}, LOGS);
    expect(postings(s, LOGS)).toEqual([
      {
        id: 1,
        kind: 'delivery',
        conditions: [{ kind: 'building', anyOf: ['trade_post'], met: true }],
        coin: 50,
        endsAt: 3 * DAY,
        canAccept: true,
        coinShort: false,
        accepted: false,
        goods: { resource: 'logs', amount: 10, delivered: 0 },
        master: null,
      },
    ]);
    // One at a time: the next Dawn posts no other.
    expect(postings(run(s, DAY, {}, LOGS), LOGS).map((p) => p.id)).toEqual([1]);
  });

  it('asks only for goods the village can make, and only once a notice board stands', () => {
    const planks = only({ resource: 'planks', amount: 10, days: 3, reward: 50 });
    expect(postings(run(village(), 1, {}, planks), planks)).toEqual([]);
    const noBoard = { ...yard, buildings: yard.buildings.filter((b) => b.type !== 'notice_board') };
    expect(postings(run(village(noBoard), 1, {}, LOGS), LOGS)).toEqual([]);
  });

  it('needs the trade post to be accepted', () => {
    const noPost = { ...yard, buildings: yard.buildings.filter((b) => b.type !== 'trade_post') };
    const s = run(village(noPost), 2, { 1: [accept(1)] }, LOGS);
    const [order] = postings(s, LOGS);
    expect(order?.conditions[0]?.met).toBe(false);
    expect(order?.canAccept).toBe(false);
    expect(order?.accepted).toBe(false);
  });

  it('nothing is carried until it is accepted', () => {
    expect(piledLogs(run(village(), 600, {}, LOGS))).toBe(20);
  });

  it('accepted, Carriers bring the goods to the trade post, and once filled it pays its reward', () => {
    const accepted = run(village(), 2, { 1: [accept(1)] }, LOGS);
    expect(postings(accepted, LOGS)[0]).toMatchObject({ accepted: true, canAccept: false });
    const filled = until(accepted, (x) => x.treasury > 0, 3000, LOGS);
    expect(filled.treasury).toBe(50 * COIN);
    expect(piledLogs(filled)).toBe(10);
    expect(postings(filled, LOGS)).toEqual([]);
    // Handed over, not kept: nothing for sale or waiting at the trade post.
    const post = filled.components.building[POST];
    expect(post?.input.logs ?? 0).toBe(0);
    expect(post?.stock.logs ?? 0).toBe(0);
    // And no more is carried in.
    expect(piledLogs(run(filled, 600, {}, LOGS))).toBe(10);
  });

  it('unfilled, it fails at its deadline; the next is posted a few days after', () => {
    const s = run(village(), 2, { 1: [accept(1)] }, LOGS);
    for (const pile of Object.values(s.components.stockpile)) pile.goods = {};
    const due = run({ ...s, tick: dawnTick(4, LOGS) - 1 }, 2, {}, LOGS);
    expect(postings(due, LOGS)).toEqual([]);
    expect(due.treasury).toBe(0);
    const gap = LOGS.deliveries.gapDays;
    expect(postings(run({ ...due, tick: dawnTick(3 + gap, LOGS) }, 1, {}, LOGS), LOGS)).toEqual([]);
    const next = run({ ...due, tick: dawnTick(4 + gap, LOGS) }, 1, {}, LOGS);
    expect(postings(next, LOGS).map((p) => p.id)).toEqual([2]);
  });

  it('is deterministic, and a save mid-order plays on the same', () => {
    const play = () => run(village(), 2 * DAY, { 1: [accept(1)] });
    const a = play();
    expect(postings(a, content).filter((p) => p.kind === 'delivery')).toHaveLength(1);
    expect(a).toEqual(play());
    const mid = run(village(), 400, { 1: [accept(1)] });
    expect(run(deserialize(serialize(mid), content), 600)).toEqual(run(mid, 600));
  });
});
