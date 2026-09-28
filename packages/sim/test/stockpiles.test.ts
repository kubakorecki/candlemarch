import type { ResourceId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { blockedGrid, canPlaceBuilding, tileAt, tileIndex } from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath } from '../src/roads';
import type { GameState, StockpileComponent } from '../src/state';
import { step } from '../src/step';
import { canPlaceStockpile } from '../src/stockpiles';
import { content, run, runUntil } from './helpers';

// Woodcutter's hut at (0,0) with its door at (1,2), a tree at (6,0), and one carrier.
const yard: MapDef = {
  name: 'yard',
  rows: ['......T.....', ...Array(7).fill('............')],
  buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
  villagers: [{ job: 'carrier', x: 1, y: 3 }],
};

const fresh = () => createInitialState(1, yard, content);

describe('placeStockpile', () => {
  it('creates one empty stockpile from a rectangle', () => {
    const s = step(fresh(), [{ type: 'placeStockpile', x: 4, y: 4, w: 3, h: 2 }], content);
    const piles = idsOf(s.components.stockpile);
    expect(piles).toHaveLength(1);
    const id = piles[0] as number;
    expect(s.components.tile[id]).toEqual({ x: 4, y: 4 });
    expect(s.components.stockpile[id]).toEqual({
      size: { w: 3, h: 2 },
      priority: 'normal',
      refuses: [],
      goods: {},
    });
  });

  it('ignores rectangles with any tile that is taken or off the map', () => {
    const s0 = run(fresh(), 1, {
      0: [
        { type: 'placeBuilding', building: 'hut', x: 9, y: 2 }, // site with its door at (9,3)
        { type: 'layPath', from: { x: 0, y: 6 }, to: { x: 3, y: 6 } },
        { type: 'placeStockpile', x: 4, y: 4, w: 3, h: 2 },
      ],
    });
    const invalid = [
      { x: 5, y: 0, w: 2, h: 1 }, // tree at (6,0)
      { x: 1, y: 1, w: 1, h: 1 }, // woodcutter's hut footprint
      { x: 1, y: 2, w: 2, h: 1 }, // woodcutter's hut door
      { x: 9, y: 2, w: 1, h: 1 }, // site footprint
      { x: 8, y: 3, w: 2, h: 1 }, // site door
      { x: 2, y: 5, w: 2, h: 2 }, // path
      { x: 6, y: 5, w: 2, h: 1 }, // the other stockpile
      { x: 11, y: 7, w: 2, h: 1 }, // off the map
      { x: -1, y: 0, w: 1, h: 1 },
      { x: 2.5, y: 3, w: 1, h: 1 },
      { x: 2, y: 3, w: 0, h: 1 },
      { x: 2, y: 3, w: 1.5, h: 1 },
    ];
    for (const r of invalid) {
      const label = `${r.x},${r.y} ${r.w}×${r.h}`;
      expect(canPlaceStockpile(s0, content, r.x, r.y, r.w, r.h), label).toBe(false);
      const s = step(s0, [{ type: 'placeStockpile', ...r }], content);
      expect(idsOf(s.components.stockpile), label).toHaveLength(1);
    }
  });

  it("doesn't merge with a neighbouring stockpile", () => {
    const s0 = step(fresh(), [{ type: 'placeStockpile', x: 4, y: 4, w: 3, h: 2 }], content);
    expect(canPlaceStockpile(s0, content, 7, 4, 1, 2)).toBe(true);
    const s = step(s0, [{ type: 'placeStockpile', x: 7, y: 4, w: 1, h: 2 }], content);
    expect(idsOf(s.components.stockpile)).toHaveLength(2);
  });

  it('keeps buildings and paths off its tiles, but not walkers', () => {
    const s = step(fresh(), [{ type: 'placeStockpile', x: 4, y: 4, w: 3, h: 2 }], content);
    expect(canPlaceBuilding(s, content, 'hut', 5, 4)).toBe(false); // footprint on it
    expect(canPlaceBuilding(s, content, 'hut', 5, 3)).toBe(false); // door on it
    expect(canPlaceBuilding(s, content, 'hut', 7, 3)).toBe(true);
    expect(canLayPath(s, content, { x: 3, y: 5 }, { x: 8, y: 5 })).toBe(false);
    expect(blockedGrid(s, content)[tileIndex(s.map, 5, 5)]).toBe(0);
  });
});

// The yard without its tree: the woodcutter idles, so the hut's buffer only changes by hand.
const bare: MapDef = { ...yard, name: 'bare', rows: Array(8).fill('............') };

/** A bare yard whose woodcutter's hut buffer holds `logs`. */
function stocked(logs: number): GameState {
  const s = createInitialState(1, bare, content);
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

function hutStock(s: GameState): number {
  const hut = idsOf(s.components.building)[0] as number;
  return s.components.building[hut]?.stock.logs ?? 0;
}

function carrierOf(s: GameState) {
  const id = idsOf(s.components.villager).find(
    (v) => s.components.villager[v]?.job === 'carrier',
  ) as number;
  return { id, haul: s.logistics.hauls[id], position: s.components.position[id] };
}

/** Goods of the stockpile with this ID, as "x,y": "resource amount". */
function goodsOf(s: GameState, id: number): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [i, g] of Object.entries(s.components.stockpile[id]?.goods ?? {})) {
    const { x, y } = tileAt(s.map, Number(i));
    result[`${x},${y}`] = `${g.resource} ${g.amount}`;
  }
  return result;
}

function pileTotal(s: GameState, id: number): number {
  return Object.values(s.components.stockpile[id]?.goods ?? {}).reduce((n, g) => n + g.amount, 0);
}

describe('stockpiles in job dispatch', () => {
  // A 3×2 stockpile whose tile nearest the woodcutter's hut door (1,2) is (4,4).
  const placePile: Command = { type: 'placeStockpile', x: 4, y: 4, w: 3, h: 2 };

  it("fill up from a workplace's buffer, onto the nearest tile with room", () => {
    const s0 = step(stocked(4), [placePile], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const first = runUntil(s0, (s) => pileTotal(s, pile) === 1, 1000);
    expect(goodsOf(first, pile)).toEqual({ '4,4': 'logs 1' });
    // The carrier walked onto that tile to drop it.
    expect(carrierOf(first).position).toEqual({ x: 4500, y: 4500 });

    const all = runUntil(first, (s) => pileTotal(s, pile) === 4, 1000);
    expect(goodsOf(all, pile)).toEqual({ '4,4': 'logs 4' });
    expect(hutStock(all)).toBe(0);
  });

  it('go to the nearest stockpile with room, not the oldest', () => {
    const far: Command = { type: 'placeStockpile', x: 10, y: 6, w: 1, h: 1 };
    const near: Command = { type: 'placeStockpile', x: 3, y: 2, w: 1, h: 1 };
    const s0 = step(stocked(10), [far, near], content);
    const [older, newer] = idsOf(s0.components.stockpile) as [number, number];
    const cap = content.logistics.stockpileTileCapacity;

    const nearFull = runUntil(s0, (s) => pileTotal(s, newer) === cap, 3000);
    expect(pileTotal(nearFull, newer)).toBe(cap);
    expect(pileTotal(nearFull, older)).toBe(0);
    // Only once the near one is full does the far one get any.
    const all = runUntil(nearFull, (s) => pileTotal(s, older) === 10 - cap, 3000);
    expect(pileTotal(all, older)).toBe(10 - cap);
  });

  it('measure nearness by walking time, so a road makes a farther stockpile nearer', () => {
    // Off-road (7,7) is 8070 straight from the door (1,2), and at least 7736 to walk. Along the
    // road, (11,2) is 9 × 666 + 1000 = 6994 to walk, though 10000 straight.
    const s0 = step(
      stocked(1),
      [
        { type: 'layPath', from: { x: 1, y: 2 }, to: { x: 10, y: 2 } },
        { type: 'placeStockpile', x: 7, y: 7, w: 1, h: 1 },
        { type: 'placeStockpile', x: 11, y: 2, w: 1, h: 1 },
      ],
      content,
    );
    const [offRoad, onRoad] = idsOf(s0.components.stockpile) as [number, number];
    const s = runUntil(s0, (x) => pileTotal(x, offRoad) + pileTotal(x, onRoad) === 1, 2000);
    expect(pileTotal(s, onRoad)).toBe(1);
  });

  it('fill higher priority stockpiles first, however far', () => {
    const base = stocked(2);
    const near = base.nextId;
    const far = near + 1;
    // Set in the same tick as placing, before the carrier is given a haul.
    const s1 = step(
      base,
      [
        { type: 'placeStockpile', x: 3, y: 2, w: 1, h: 1 },
        { type: 'placeStockpile', x: 10, y: 6, w: 1, h: 1 },
        { type: 'setStockpilePriority', id: far, priority: 'high' },
      ],
      content,
    );
    const s = runUntil(s1, (x) => pileTotal(x, far) === 2, 3000);
    expect(pileTotal(s, far)).toBe(2);
    expect(pileTotal(s, near)).toBe(0);
  });

  it("don't take resources they refuse; goods already on them stay", () => {
    const s0 = step(
      stocked(3),
      [
        { type: 'placeStockpile', x: 3, y: 2, w: 1, h: 1 },
        { type: 'placeStockpile', x: 10, y: 6, w: 1, h: 1 },
      ],
      content,
    );
    const [near, far] = idsOf(s0.components.stockpile) as [number, number];
    const one = runUntil(s0, (x) => pileTotal(x, near) === 1, 1000);
    const refuse: Command = {
      type: 'setStockpileAccepts',
      id: near,
      resource: 'logs',
      accepts: false,
    };
    const s1 = step(one, [refuse], content);
    expect(s1.components.stockpile[near]?.refuses).toEqual(['logs']);
    const s = runUntil(s1, (x) => pileTotal(x, far) === 2, 3000);
    expect(pileTotal(s, far)).toBe(2);
    expect(pileTotal(s, near)).toBe(1);

    const again = step(s, [{ ...refuse, accepts: true }], content);
    expect(again.components.stockpile[near]?.refuses).toEqual([]);
  });

  it('ignore settings for things that are not stockpiles, and unknown values', () => {
    const s0 = step(stocked(0), [{ type: 'placeStockpile', x: 3, y: 2, w: 1, h: 1 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const s1 = step(
      s0,
      [
        { type: 'setStockpilePriority', id: pile, priority: 'urgent' as 'high' },
        { type: 'setStockpileAccepts', id: pile, resource: 'stone' as ResourceId, accepts: false },
        { type: 'setStockpilePriority', id: 999, priority: 'high' },
      ],
      content,
    );
    expect(s1.components.stockpile[pile]).toEqual(s0.components.stockpile[pile]);
  });

  it(`hold at most ${content.logistics.stockpileTileCapacity} units per tile`, () => {
    const s0 = step(stocked(20), [{ type: 'placeStockpile', x: 4, y: 4, w: 1, h: 2 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const full = runUntil(s0, (s) => pileTotal(s, pile) === 16, 3000);
    expect(goodsOf(full, pile)).toEqual({ '4,4': 'logs 8', '4,5': 'logs 8' });
    // With no room left, the rest stays put.
    const later = run(full, 300);
    expect(goodsOf(later, pile)).toEqual(goodsOf(full, pile));
    expect(hutStock(later)).toBe(4);
    expect(carrierOf(later).haul).toBeUndefined();
  });

  it('put one resource on a tile', () => {
    const s0 = step(stocked(3), [{ type: 'placeStockpile', x: 4, y: 4, w: 1, h: 2 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    // The tile nearest the hut already holds something else (not in content yet).
    const stone = { resource: 'stone' as ResourceId, amount: 1 };
    (s0.components.stockpile[pile] as StockpileComponent).goods[tileIndex(s0.map, 4, 4)] = stone;
    const s = runUntil(s0, (st) => hutStock(st) === 0 && !carrierOf(st).haul, 1000);
    expect(goodsOf(s, pile)).toEqual({ '4,4': 'stone 1', '4,5': 'logs 3' });
  });

  it('break ties between equally near tiles by tile index', () => {
    const s0 = step(stocked(1), [{ type: 'placeStockpile', x: 0, y: 4, w: 3, h: 1 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    // Block the middle tile, nearest the door (1,2); (0,4) and (2,4) are equally near.
    const stone = { resource: 'stone' as ResourceId, amount: 1 };
    (s0.components.stockpile[pile] as StockpileComponent).goods[tileIndex(s0.map, 1, 4)] = stone;
    const s = runUntil(s0, (st) => pileTotal(st, pile) === 2, 1000);
    expect(goodsOf(s, pile)).toEqual({ '0,4': 'logs 1', '1,4': 'stone 1' });
  });

  it('supply construction sites, from the nearest tile holding the resource', () => {
    // No workplace here: the stockpile is the only source.
    const s0 = createInitialState(1, { ...bare, buildings: [] }, content);
    const s1 = step(s0, [{ type: 'placeStockpile', x: 4, y: 4, w: 2, h: 1 }], content);
    const pile = idsOf(s1.components.stockpile)[0] as number;
    const goods = (s1.components.stockpile[pile] as StockpileComponent).goods;
    goods[tileIndex(s1.map, 4, 4)] = { resource: 'logs', amount: 8 };
    goods[tileIndex(s1.map, 5, 4)] = { resource: 'logs', amount: 4 };

    // A hut site far to the east; the carrier at (1,3) is nearest to (4,4).
    const placed = step(s1, [{ type: 'placeBuilding', building: 'hut', x: 9, y: 2 }], content);
    const loaded = runUntil(placed, (s) => carrierOf(s).haul?.phase === 'dropoff', 500);
    expect(carrierOf(loaded).position).toEqual({ x: 4500, y: 4500 });
    expect(goodsOf(loaded, pile)).toEqual({ '4,4': 'logs 7', '5,4': 'logs 4' });

    const built = runUntil(loaded, (s) => idsOf(s.components.building).length === 1, 5000);
    expect(idsOf(built.components.building)).toHaveLength(1);
    expect(pileTotal(built, pile)).toBe(2);
  });

  it('come after every construction site', () => {
    // The stockpile is older and nearer, but the site gets the logs.
    const s = runUntil(stocked(4), (st) => hutStock(st) === 0 && !carrierOf(st).haul, 3000, {
      0: [placePile, { type: 'placeBuilding', building: 'hut', x: 9, y: 2 }],
    });
    const site = idsOf(s.components.site)[0] as number;
    expect(s.components.site[site]?.delivered.logs).toBe(4);
    expect(pileTotal(s, idsOf(s.components.stockpile)[0] as number)).toBe(0);
  });

  it('never supply another stockpile', () => {
    const s0 = createInitialState(1, { ...bare, buildings: [] }, content);
    const s1 = step(
      s0,
      [
        { type: 'placeStockpile', x: 4, y: 4, w: 1, h: 1 },
        { type: 'placeStockpile', x: 8, y: 4, w: 1, h: 1 },
      ],
      content,
    );
    const [full, empty] = idsOf(s1.components.stockpile) as [number, number];
    (s1.components.stockpile[full] as StockpileComponent).goods[tileIndex(s1.map, 4, 4)] = {
      resource: 'logs',
      amount: 5,
    };
    const s = runUntil(s1, (st) => carrierOf(st).haul !== undefined, 300);
    expect(carrierOf(s).haul).toBeUndefined();
    expect(pileTotal(s, full)).toBe(5);
    expect(pileTotal(s, empty)).toBe(0);
  });
});

describe('stockpile tile capacity with returns', () => {
  it("isn't promised to a new haul while goods are on their way back to the tile", () => {
    // Carrier 3 starts at the hut door, carrier 4 next to a full one-tile stockpile at (6,6).
    const s1 = stocked(4);
    const id = s1.nextId;
    const pile = id + 1;
    s1.nextId += 2;
    s1.components.villager[id] = {
      name: 'Ada',
      job: 'carrier',
      workplace: null,
      carrying: null,
      home: null,
      routine: 'work',
      sleptTicks: 0,
      tired: false,
      missedMeals: 0,
      coldNights: 0,
    };
    s1.components.position[id] = { x: 6500, y: 7500 };
    const tile = tileIndex(s1.map, 6, 6);
    s1.components.tile[pile] = { x: 6, y: 6 };
    s1.components.stockpile[pile] = {
      size: { w: 1, h: 1 },
      priority: 'normal',
      refuses: [],
      goods: { [tile]: { resource: 'logs', amount: 8 } },
    };

    // Both carriers take a log to a site; carrier 4 takes its log from the stockpile.
    const placed = step(s1, [{ type: 'placeBuilding', building: 'hut', x: 11, y: 0 }], content);
    const site = idsOf(placed.components.site)[0] as number;
    const loaded = runUntil(
      placed,
      (s) =>
        s.logistics.hauls[id]?.phase === 'dropoff' && s.logistics.hauls[3]?.phase === 'dropoff',
      500,
    );
    expect(loaded.logistics.hauls[id]?.from).toBe(pile);

    // The site is cancelled, so both logs go back; the stockpile tile must not overfill.
    const cancelled = step(loaded, [{ type: 'cancelConstruction', siteId: site }], content);
    let s = cancelled;
    for (let i = 0; i < 1000; i++) {
      s = run(s, 1);
      expect(s.components.stockpile[pile]?.goods[tile]?.amount ?? 0).toBeLessThanOrEqual(8);
    }
    expect(s.components.stockpile[pile]?.goods[tile]?.amount).toBe(8);
    expect(hutStock(s)).toBe(4);
  });
});

describe('removeStockpile', () => {
  it('removes the stockpile and its goods', () => {
    const s0 = step(fresh(), [{ type: 'placeStockpile', x: 4, y: 4, w: 2, h: 1 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    (s0.components.stockpile[pile] as StockpileComponent).goods[tileIndex(s0.map, 4, 4)] = {
      resource: 'logs',
      amount: 5,
    };
    const s = step(s0, [{ type: 'removeStockpile', id: pile }], content);
    expect(s.components.stockpile[pile]).toBeUndefined();
    expect(s.components.tile[pile]).toBeUndefined();
    expect(canPlaceStockpile(s, content, 4, 4, 2, 1)).toBe(true);
  });

  it('ignores ids that are not stockpiles', () => {
    const s0 = fresh();
    const hut = idsOf(s0.components.building)[0] as number;
    const s = step(s0, [{ type: 'removeStockpile', id: hut }], content);
    expect(s.components.building[hut]).toBeDefined();
  });

  it('mid-haul, the carrier brings the log back', () => {
    const s0 = step(stocked(1), [{ type: 'placeStockpile', x: 8, y: 6, w: 1, h: 1 }], content);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const carrying = runUntil(s0, (s) => carrierOf(s).haul?.phase === 'dropoff', 500);
    expect(hutStock(carrying)).toBe(0);
    const removed = step(carrying, [{ type: 'removeStockpile', id: pile }], content);
    const back = runUntil(removed, (s) => !carrierOf(s).haul, 500);
    expect(hutStock(back)).toBe(1);
  });
});

describe('what stockpiles store', () => {
  /** The bare yard with `logs` in the hut's buffer, a 1×2 stockpile at (4,4) and the hero at (8,6). */
  function withHero(logs: number): { s: GameState; pile: number; hero: number } {
    const s0 = createInitialState(1, { ...bare, hero: { x: 8, y: 6 } }, content);
    const hutId = idsOf(s0.components.building)[0] as number;
    s0.components.building[hutId] = {
      type: 'woodcutters_hut',
      rotation: 0,
      stock: { logs },
      input: {},
      workerLimit: 1,
      cold: false,
    };
    const s = step(s0, [{ type: 'placeStockpile', x: 4, y: 4, w: 1, h: 2 }], content);
    return {
      s,
      pile: idsOf(s.components.stockpile)[0] as number,
      hero: idsOf(s.components.hero)[0] as number,
    };
  }

  it('hold every stockpile resource, one resource per tile', () => {
    const { s: s0, pile, hero } = withHero(3);
    // Carriers bring the logs to (4,4), nearest the hut; the hero brings firewood by hand.
    const h = s0.components.hero[hero];
    if (h) h.carrying = { resource: 'firewood', amount: 2 };
    const s = runUntil(s0, (st) => pileTotal(st, pile) === 5, 2000, {
      [s0.tick + 40]: [{ type: 'orderHero', order: 'deliver', target: pile }],
    });
    expect(goodsOf(s, pile)).toEqual({ '4,4': 'logs 3', '4,5': 'firewood 2' });
  });

  it('refuse Food, whatever their settings', () => {
    const { s: s0, pile, hero } = withHero(0);
    const h = s0.components.hero[hero];
    if (h) h.carrying = { resource: 'fish', amount: 2 };
    expect(heroOrderAt(s0, content, { x: 4, y: 4 })).toBeNull();

    const s = run(s0, 2, {
      [s0.tick]: [{ type: 'setStockpileAccepts', id: pile, resource: 'fish', accepts: true }],
      [s0.tick + 1]: [{ type: 'orderHero', order: 'deliver', target: pile }],
    });
    expect(s.components.hero[hero]?.order).toBeNull();
    expect(s.components.stockpile[pile]?.refuses).toEqual([]);
    const refused = step(
      s,
      [{ type: 'setStockpileAccepts', id: pile, resource: 'fish', accepts: false }],
      content,
    );
    expect(refused.components.stockpile[pile]?.refuses).toEqual([]);
  });
});
