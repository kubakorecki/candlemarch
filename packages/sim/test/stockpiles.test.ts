import type { ResourceId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { blockedGrid, canPlaceBuilding, tileAt, tileIndex } from '../src/grid';
import { haulsOf } from '../src/logistics/jobDispatch';
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
    expect(s.components.stockpile[id]).toEqual({ size: { w: 3, h: 2 }, goods: {} });
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
  s.components.building[hut] = { type: 'woodcutters_hut', stock: { logs } };
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
  return { id, haul: haulsOf(s)[id], position: s.components.position[id] };
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
    s1.components.villager[id] = { job: 'carrier', workplace: null, carrying: null };
    s1.components.position[id] = { x: 6500, y: 7500 };
    const tile = tileIndex(s1.map, 6, 6);
    s1.components.tile[pile] = { x: 6, y: 6 };
    s1.components.stockpile[pile] = {
      size: { w: 1, h: 1 },
      goods: { [tile]: { resource: 'logs', amount: 8 } },
    };

    // Both carriers take a log to a site; carrier 4 takes its log from the stockpile.
    const placed = step(s1, [{ type: 'placeBuilding', building: 'hut', x: 11, y: 0 }], content);
    const site = idsOf(placed.components.site)[0] as number;
    const loaded = runUntil(
      placed,
      (s) => haulsOf(s)[id]?.phase === 'dropoff' && haulsOf(s)[3]?.phase === 'dropoff',
      500,
    );
    expect(haulsOf(loaded)[id]?.from).toBe(pile);

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
