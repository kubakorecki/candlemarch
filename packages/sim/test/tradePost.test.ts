// The trade post, Coin and Merchants (spec, Economy: Coin; The trade post in M5): sell rules bring
// the village's surplus into the trade post's Storage, Merchants buy it for coin on their visits,
// flooding a good lowers its price, and Wanted goods pay more.
import type { Content, ResourceId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { calendarAt, dawnTick } from '../src/calendar';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { villageStock } from '../src/standingOrders';
import type { EntityId, GameState } from '../src/state';
import { step } from '../src/step';
import { amountOnTile } from '../src/stockpiles';
import { storageOf } from '../src/storage';
import { nextMerchantDay, priceOf } from '../src/tradePost';
import { COIN, treasuryCoin } from '../src/treasury';
import { content, run, runUntil } from './helpers';

/** Units of `resource` on every Stockpile. */
function piled(s: GameState, resource: ResourceId): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), resource);
  }
  return total;
}

/** The trade post (ID 1) on the `market` map. */
const POST: EntityId = 1;

/** Units of `resource` in the trade post's Storage. */
function forSale(s: GameState, resource: ResourceId): number {
  return storageOf(s, content, POST)?.goods.find((g) => g.resource === resource)?.amount ?? 0;
}

/** A trade post 1 at (1,1), a Stockpile 2 with 12 logs, two Carriers. */
const market: MapDef = {
  name: 'market',
  rows: Array(7).fill('..........'),
  buildings: [{ type: 'trade_post', x: 1, y: 1 }],
  stockpiles: [{ x: 5, y: 1, w: 2, h: 2, goods: [{ resource: 'logs', amount: 12 }] }],
  villagers: [
    { job: 'carrier', x: 4, y: 4 },
    { job: 'carrier', x: 5, y: 4 },
  ],
};

const KEEP_4_LOGS = { 0: [{ type: 'setSellRule' as const, resource: 'logs' as const, keep: 4 }] };

function hamlet(map: MapDef = market): GameState {
  const s = createInitialState(1, map, content);
  s.rank = 'hamlet';
  return s;
}

describe('the trade post', () => {
  it('is a Hamlet building, one a village', () => {
    const unlocks = content.ranks.find((r) => r.id === 'hamlet')?.unlocks.buildings;
    expect(unlocks).toContain('trade_post');
    expect(content.buildings.trade_post.onePerVillage).toBe(true);
  });

  it('a sell rule brings the surplus over what the village keeps into its Storage', () => {
    const start = hamlet();
    const s = runUntil(start, (x) => forSale(x, 'logs') >= 8, 2000, KEEP_4_LOGS);
    expect(forSale(s, 'logs')).toBe(8);
    expect(piled(s, 'logs')).toBe(4);
    const later = run(s, 400);
    expect(forSale(later, 'logs')).toBe(8);
    expect(piled(later, 'logs')).toBe(4);
  });

  it('nothing is sold without a rule', () => {
    const s = run(hamlet(), 1000);
    expect(forSale(s, 'logs')).toBe(0);
    expect(piled(s, 'logs')).toBe(12);
  });

  it('goods for sale are not what the village holds, so standing orders keep working', () => {
    const s = hamlet();
    const post = s.components.building[POST];
    if (post) post.input.logs = 50;
    expect(villageStock(s, content, 'logs')).toBe(12);
  });
});

/** The market on the Dawn of day `day`, before it runs, with `stock` for sale. */
function marketAt(day: number, stock: Partial<Record<ResourceId, number>>, wanted: ResourceId[]) {
  const s = hamlet();
  s.tick = dawnTick(day, content);
  const post = s.components.building[POST];
  if (post) post.input = { ...stock };
  s.tradePost.wanted = wanted;
  return s;
}

describe('Merchants', () => {
  it('a Merchant arrives on the third day and buys everything for sale into the Treasury', () => {
    const s = run(marketAt(3, { logs: 20 }, ['ale']), 1);
    expect(s.tradePost.merchantHere).toBe(true);
    expect(forSale(s, 'logs')).toBe(0);
    // 20 logs from 2.00 coin down by 0.01 a unit: 2.00 + 1.99 + ... + 1.81.
    expect(s.treasury).toBe(3810);
    expect(treasuryCoin(s)).toBe(38);
    expect(priceOf(s, content, 'logs')).toBe(180);
  });

  it('no Merchant comes on other days, nor without a trade post', () => {
    expect(run(marketAt(2, { logs: 20 }, []), 1).treasury).toBe(0);
    const gone = marketAt(3, { logs: 20 }, []);
    delete gone.components.building[POST];
    expect(run(gone, 1).tradePost.merchantHere).toBe(false);
  });

  it('Wanted goods pay 50% more', () => {
    const s = run(marketAt(3, { logs: 2 }, ['logs']), 1);
    // 2.00 × 1.5 + 1.99 × 1.5, each rounded down to a hundredth.
    expect(s.treasury).toBe(300 + 298);
  });

  it('selling many units drops the price to 30% of base, and it recovers 10% of base a day', () => {
    let s = run(marketAt(3, { iron_bars: 40 }, []), 1);
    expect(priceOf(s, content, 'iron_bars')).toBe(450); // 15.00 down to its floor, 4.50
    s = run(s, content.calendar.dayTicks);
    expect(priceOf(s, content, 'iron_bars')).toBe(600);
    s = run(s, 6 * content.calendar.dayTicks);
    expect(priceOf(s, content, 'iron_bars')).toBe(1500);
    expect(s.tradePost.prices).toEqual({});
  });

  it('none come in winter', () => {
    const winterDay = 18;
    expect(calendarAt(dawnTick(winterDay, content), content).season).toBe('winter');
    const s = run(marketAt(winterDay, { logs: 5 }, []), 1);
    expect(s.tradePost.merchantHere).toBe(false);
    expect(s.treasury).toBe(0);
    expect(nextMerchantDay(s, content)).toBe(21);
  });

  it('a Merchant leaves at the next Dawn, announcing the next Wanted list of 2–3 goods', () => {
    const s = run(marketAt(3, {}, ['ale']), 1 + content.calendar.dayTicks);
    expect(s.tradePost.merchantHere).toBe(false);
    const wanted = s.tradePost.wanted ?? [];
    expect(wanted.length).toBeGreaterThanOrEqual(2);
    expect(wanted.length).toBeLessThanOrEqual(3);
    expect(new Set(wanted).size).toBe(wanted.length);
    expect(nextMerchantDay(s, content)).toBe(6);
  });

  it('the first Wanted list is announced at the first Dawn a trade post stands', () => {
    const s = hamlet();
    expect(s.tradePost.wanted).toBeNull();
    expect(run(s, content.calendar.dayTicks + 1).tradePost.wanted?.length).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    const play = () => run(hamlet(), 3 * content.calendar.dayTicks + 2, KEEP_4_LOGS);
    const a = play();
    const b = play();
    expect(a.treasury).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
});

/** Units of `resource` Merchants brought, waiting in the trade post for Carriers. */
function imported(s: GameState, resource: ResourceId): number {
  return s.components.building[POST]?.stock[resource] ?? 0;
}

describe('imports', () => {
  const orderStone = { type: 'orderImport' as const, resource: 'stone' as const, amount: 5 };

  it('an order spends twice the base price at once, and the next Merchant brings the goods', () => {
    const s = hamlet();
    s.treasury = 100 * COIN;
    const ordered = step(s, [orderStone], content);
    // 5 stone at twice 2.00 each.
    expect(treasuryCoin(ordered)).toBe(80);
    expect(ordered.tradePost.orders).toEqual({ stone: 5 });
    ordered.tick = dawnTick(3, content);
    const arrived = run(ordered, 1);
    expect(arrived.tradePost.merchantHere).toBe(true);
    expect(imported(arrived, 'stone')).toBe(5);
    expect(arrived.tradePost.orders).toEqual({});
    expect(treasuryCoin(arrived)).toBe(80);
  });

  it('Carriers take what arrived where it is wanted, and the Merchant never buys it back', () => {
    const s = hamlet();
    s.treasury = 100 * COIN;
    s.tick = dawnTick(3, content);
    const arrived = run(s, 1, { [s.tick]: [orderStone] });
    expect(imported(arrived, 'stone')).toBe(5);
    expect(forSale(arrived, 'stone')).toBe(0);
    const carried = runUntil(arrived, (x) => piled(x, 'stone') === 5, 2000);
    expect(piled(carried, 'stone')).toBe(5);
    expect(imported(carried, 'stone')).toBe(0);
  });

  it("an order the Treasury can't cover is refused", () => {
    const s = hamlet();
    s.treasury = 19 * COIN;
    const after = step(s, [orderStone], content);
    expect(after.treasury).toBe(19 * COIN);
    expect(after.tradePost.orders).toEqual({});
  });

  it('only goods in the catalogue can be ordered, and only at a trade post', () => {
    const s = hamlet();
    s.treasury = 1000 * COIN;
    const planks = { type: 'orderImport' as const, resource: 'planks' as const, amount: 5 };
    expect(step(s, [planks], content).tradePost.orders).toEqual({});
    delete s.components.building[POST];
    expect(step(s, [orderStone], content).tradePost.orders).toEqual({});
  });
});

describe('coin construction costs', () => {
  /** Content whose notice board also costs 50 coin. */
  const dear: Content = {
    ...content,
    buildings: {
      ...content.buildings,
      notice_board: {
        ...content.buildings.notice_board,
        construction: { cost: [], coin: 50, buildTicks: 200 },
      },
    },
  };
  const place = { type: 'placeBuilding' as const, building: 'notice_board' as const, x: 1, y: 5 };

  it("are refused when the Treasury can't cover them", () => {
    const s = hamlet();
    s.treasury = 49 * COIN;
    expect(canPlaceBuilding(s, dear, 'notice_board', 1, 5)).toBe(false);
    const after = step(s, [place], dear);
    expect(Object.keys(after.components.site)).toHaveLength(0);
    expect(after.treasury).toBe(49 * COIN);
  });

  it('leave the Treasury when the site is placed', () => {
    const s = hamlet();
    s.treasury = 60 * COIN;
    const after = step(s, [place], dear);
    expect(Object.keys(after.components.site)).toHaveLength(1);
    expect(treasuryCoin(after)).toBe(10);
  });
});
