// The hero kickstarts the village by hand: chops trees and carries goods (spec, logistics stage 1).
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { step } from '../src/step';
import { content, run, runUntil } from './helpers';

/** Open ground, a tree at (5,1) and the hero at (2,1). */
const clearing: MapDef = {
  name: 'clearing',
  rows: ['............', '.....T......', '............', '............', '............'],
  buildings: [],
  villagers: [],
  hero: { x: 2, y: 1 },
};

function heroId(s: GameState): number {
  return idsOf(s.components.hero)[0] as number;
}

function hero(s: GameState) {
  return s.components.hero[heroId(s)];
}

function treeAt(s: GameState, x: number, y: number): number {
  return idsOf(s.components.mapObject).find((id) => {
    const t = s.components.tile[id];
    return t?.x === x && t.y === y;
  }) as number;
}

const idle = (s: GameState) => s.tick > 0 && hero(s)?.order === null;

/**
 * A woodcutter's hut at (2,6) (door (2,7)) with no trees to chop, a woodcutter's hut site at
 * (8,2) (costs 6 logs, door (8,3)), two carriers and the hero at (4,3).
 */
const yard: MapDef = {
  name: 'yard',
  rows: Array.from({ length: 9 }, () => '............'),
  buildings: [{ type: 'woodcutters_hut', x: 2, y: 6 }],
  sites: [{ type: 'woodcutters_hut', x: 8, y: 2 }],
  villagers: [
    { job: 'carrier', x: 5, y: 7 },
    { job: 'carrier', x: 6, y: 7 },
  ],
  hero: { x: 4, y: 3 },
};

/** The yard with `buffered` logs in the hut's buffer and `inHand` in the hero's hands. */
function yardWith(buffered: number, inHand: number): GameState {
  const s = createInitialState(1, yard, content);
  const hut = idsOf(s.components.building)[0] as number;
  (s.components.building[hut] as { stock: { logs?: number } }).stock.logs = buffered;
  const h = hero(s);
  if (h && inHand > 0) h.carrying = { resource: 'logs', amount: inHand };
  return s;
}

function siteId(s: GameState): number {
  return idsOf(s.components.site)[0] as number;
}

function hutStock(s: GameState): number {
  const hut = idsOf(s.components.building)[0] as number;
  return s.components.building[hut]?.stock.logs ?? 0;
}

/** Logs carriers are bringing to `target` right now. */
function haulsTo(s: GameState, target: number): number {
  return Object.values(s.logistics.hauls)
    .filter((h) => h.to === target)
    .reduce((n, h) => n + h.amount, 0);
}

describe('hero delivering', () => {
  it('delivers its logs to a site, and carriers only bring the rest', () => {
    let s = yardWith(4, 5);
    const site = siteId(s);
    s = step(s, [{ type: 'orderHero', order: 'deliver', target: site }], content);
    // The site needs 6: the hero promised 5, so carriers may bring only 1 more.
    expect(hero(s)?.order).toMatchObject({ kind: 'deliver', target: site, amount: 5 });
    while (s.components.site[site] && s.tick < 2000) {
      expect(haulsTo(s, site)).toBeLessThanOrEqual(1);
      s = step(s, [], content);
    }
    expect(s.components.building[site]).toBeDefined(); // built
    expect(hero(s)?.carrying).toBeNull();
    expect(hutStock(s)).toBe(3);
  });

  it('takes no delivery order for goods carriers are already bringing', () => {
    const s0 = yardWith(4, 5);
    const site = siteId(s0);
    const target = s0.components.site[site];
    if (target) target.delivered.logs = 5; // 1 still missing
    const s1 = step(s0, [], content);
    expect(haulsTo(s1, site)).toBe(1); // a carrier took the last one
    const s2 = step(s1, [{ type: 'orderHero', order: 'deliver', target: site }], content);
    expect(hero(s2)?.order).toBeNull();
  });

  it('keeps its goods when the site is cancelled on the way', () => {
    const s0 = yardWith(0, 5);
    const site = siteId(s0);
    const s = run(s0, 10, {
      0: [{ type: 'orderHero', order: 'deliver', target: site }],
      5: [{ type: 'cancelConstruction', siteId: site }],
    });
    expect(s.components.site[site]).toBeUndefined();
    expect(hero(s)?.order).toBeNull();
    expect(hero(s)?.carrying).toEqual({ resource: 'logs', amount: 5 });
  });

  it('takes no delivery order with empty hands', () => {
    const s0 = yardWith(0, 0);
    const s = step(s0, [{ type: 'orderHero', order: 'deliver', target: siteId(s0) }], content);
    expect(hero(s)?.order).toBeNull();
  });

  it('a new order withdraws the promise, and carriers bring the goods instead', () => {
    const s0 = yardWith(4, 5);
    const site = siteId(s0);
    const s1 = step(s0, [{ type: 'orderHero', order: 'deliver', target: site }], content);
    expect(haulsTo(s1, site)).toBe(1);
    const s2 = step(s1, [{ type: 'orderHero', order: 'move', x: 0, y: 0 }], content);
    expect(hero(s2)?.order).toBeNull();
    // Both carriers are busy now: the one already hauling, and the second one freed up.
    expect(haulsTo(s2, site)).toBe(2);
    expect(hero(s2)?.carrying).toEqual({ resource: 'logs', amount: 5 });
  });
});

/** The yard without its site, with a 2×1 stockpile at (9,6). */
const store: MapDef = { ...yard, sites: [], stockpiles: [{ x: 9, y: 6, w: 2, h: 1 }] };

function storeWith(onFirstTile: number, inHand: number): GameState {
  const s = createInitialState(1, store, content);
  const pile = s.components.stockpile[idsOf(s.components.stockpile)[0] as number];
  if (pile && onFirstTile > 0) pile.goods[6 * 12 + 9] = { resource: 'logs', amount: onFirstTile };
  const h = hero(s);
  if (h && inHand > 0) h.carrying = { resource: 'logs', amount: inHand };
  return s;
}

describe('hero delivering to a stockpile', () => {
  it('fills the nearest tile with room, then the next', () => {
    // 2 fit next to what's already on the first tile, the other 3 go on the next tile.
    const cap = content.logistics.stockpileTileCapacity;
    const s0 = storeWith(cap - 2, 5);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const end = runUntil(s0, idle, 500, {
      0: [{ type: 'orderHero', order: 'deliver', target: pile }],
    });
    expect(end.components.stockpile[pile]?.goods).toEqual({
      [6 * 12 + 9]: { resource: 'logs', amount: cap },
      [6 * 12 + 10]: { resource: 'logs', amount: 3 },
    });
    expect(hero(end)?.carrying).toBeNull();
  });

  it('takes no delivery order for a stockpile that refuses the goods', () => {
    const s0 = storeWith(0, 5);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const s = run(s0, 2, {
      0: [{ type: 'setStockpileAccepts', id: pile, resource: 'logs', accepts: false }],
      1: [{ type: 'orderHero', order: 'deliver', target: pile }],
    });
    expect(hero(s)?.order).toBeNull();
  });
});

describe('hero picking up', () => {
  /** The yard with nothing to build, so carriers stay idle. */
  const quietYard: MapDef = { ...yard, sites: [] };

  function quietYardWith(buffered: number, inHand: number): GameState {
    const s = createInitialState(1, quietYard, content);
    const hut = idsOf(s.components.building)[0] as number;
    (s.components.building[hut] as { stock: { logs?: number } }).stock.logs = buffered;
    const h = hero(s);
    if (h && inHand > 0) h.carrying = { resource: 'logs', amount: inHand };
    return s;
  }

  const pickUp = (source: number): Record<number, Command[]> => ({
    0: [{ type: 'orderHero', order: 'pickup', source }],
  });

  it("takes goods from a building's output buffer", () => {
    const s0 = quietYardWith(4, 0);
    const end = runUntil(s0, idle, 500, pickUp(idsOf(s0.components.building)[0] as number));
    expect(hero(end)?.carrying).toEqual({ resource: 'logs', amount: 4 });
    expect(hutStock(end)).toBe(0);
  });

  it('tops up what it holds, up to its carry capacity', () => {
    const s0 = quietYardWith(4, 3);
    const end = runUntil(s0, idle, 500, pickUp(idsOf(s0.components.building)[0] as number));
    expect(hero(end)?.carrying).toEqual({ resource: 'logs', amount: 5 });
    expect(hutStock(end)).toBe(2);
  });

  it('takes goods from a stockpile', () => {
    const s0 = storeWith(6, 0);
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const end = runUntil(s0, idle, 500, pickUp(pile));
    expect(hero(end)?.carrying).toEqual({ resource: 'logs', amount: 5 });
    expect(end.components.stockpile[pile]?.goods).toEqual({
      [6 * 12 + 9]: { resource: 'logs', amount: 1 },
    });
  });

  it('leaves goods carriers are already coming for', () => {
    // Both logs in the buffer are claimed by the two carriers on the first tick.
    const s0 = yardWith(2, 0);
    const hut = idsOf(s0.components.building)[0] as number;
    const s = run(s0, 2, { 1: [{ type: 'orderHero', order: 'pickup', source: hut }] });
    expect(Object.keys(s.logistics.hauls)).toHaveLength(2);
    expect(hero(s)?.order).toBeNull();
  });
});

describe('heroOrderAt: what a right-click on a tile means', () => {
  it('chops a tree, and walks onto open ground', () => {
    const s = createInitialState(1, clearing, content);
    expect(heroOrderAt(s, content, { x: 5, y: 1 })).toEqual({
      order: 'gather',
      tree: treeAt(s, 5, 1),
    });
    expect(heroOrderAt(s, content, { x: 8, y: 3 })).toEqual({ order: 'move', x: 8, y: 3 });
  });

  it('delivers to a site that needs what the hero holds', () => {
    const s = yardWith(0, 5);
    expect(heroOrderAt(s, content, { x: 8, y: 2 })).toEqual({
      order: 'deliver',
      target: siteId(s),
    });
  });

  it('picks up from a building with goods, and does nothing at one without', () => {
    const hut = { x: 2, y: 6 }; // a footprint tile of the woodcutter's hut
    const stocked = yardWith(4, 0);
    expect(heroOrderAt(stocked, content, hut)).toEqual({
      order: 'pickup',
      source: idsOf(stocked.components.building)[0],
    });
    expect(heroOrderAt(yardWith(0, 0), content, hut)).toBeNull();
    // Nothing to deliver to a site with empty hands, and a site has nothing to pick up.
    expect(heroOrderAt(yardWith(0, 0), content, { x: 8, y: 2 })).toBeNull();
  });

  it('delivers to a stockpile while carrying, and picks up from it with empty hands', () => {
    const tile = { x: 10, y: 6 };
    const pile = idsOf(storeWith(0, 0).components.stockpile)[0];
    expect(heroOrderAt(storeWith(6, 2), content, tile)).toEqual({ order: 'deliver', target: pile });
    expect(heroOrderAt(storeWith(6, 0), content, tile)).toEqual({ order: 'pickup', source: pile });
  });
});

describe('hero hand-carry over a whole run', () => {
  /** The yard with a few trees for both the hero and the woodcutter. */
  const camp: MapDef = {
    ...yard,
    rows: ['T..T..T.....', ...yard.rows.slice(1)],
    stockpiles: [{ x: 9, y: 6, w: 2, h: 1 }],
  };
  const trees = (s: GameState) => idsOf(s.components.mapObject);
  const s0 = createInitialState(3, camp, content);
  const hut = idsOf(s0.components.building)[0] as number;
  const pile = idsOf(s0.components.stockpile)[0] as number;
  const site = idsOf(s0.components.site)[0] as number;
  const script: Record<number, Command[]> = {
    0: [{ type: 'orderHero', order: 'gather', tree: trees(s0)[2] as number }],
    150: [{ type: 'orderHero', order: 'deliver', target: site }],
    260: [{ type: 'orderHero', order: 'gather', tree: trees(s0)[1] as number }],
    300: [{ type: 'orderHero', order: 'move', x: 5, y: 5 }], // gives up the chop
    340: [{ type: 'orderHero', order: 'pickup', source: hut }],
    420: [{ type: 'orderHero', order: 'deliver', target: pile }],
  };

  it('is deterministic', () => {
    const a = run(s0, 700, script);
    const b = run(s0, 700, script);
    expect(a).toEqual(b);
    // The script really did something: the hero put logs into the site.
    expect(a.components.site[site]?.delivered.logs ?? 0).toBeGreaterThan(0);
  });

  it.each([160, 350])(
    'save and load at tick %i continues exactly as an uninterrupted run',
    (at) => {
      const straight = run(s0, 700, script);
      const resumed = run(deserialize(serialize(run(s0, at, script)), content), 700 - at, script);
      expect(resumed).toEqual(straight);
    },
  );
});

describe('hero gathering', () => {
  it('walks to a tree, chops it down and carries the logs', () => {
    const s0 = createInitialState(1, clearing, content);
    const tree = treeAt(s0, 5, 1);
    const orders: Record<number, Command[]> = { 0: [{ type: 'orderHero', order: 'gather', tree }] };
    const end = runUntil(s0, idle, 1000, orders);
    // A tree holds 3 logs, 1 per 40-tick chop; the hero carries up to 5.
    expect(hero(end)?.carrying).toEqual({ resource: 'logs', amount: 3 });
    expect(end.components.mapObject[tree]?.type).toBe('stump');
    // 2 tiles of walking (20 ticks at 100/tick) then 3 chops of 40 ticks; the tick it arrives
    // on already counts towards the first chop.
    expect(end.tick).toBe(20 + 3 * 40 - 1);
  });

  it('gives up when someone else fells the tree first', () => {
    const s0 = createInitialState(1, clearing, content);
    const tree = treeAt(s0, 5, 1);
    const s1 = run(s0, 5, { 0: [{ type: 'orderHero', order: 'gather', tree }] });
    // As a woodcutter taking the last log would.
    delete s1.components.mapObject[tree];
    delete s1.components.tile[tree];
    const end = runUntil(s1, idle, 200);
    expect(hero(end)?.order).toBeNull();
    expect(hero(end)?.carrying).toBeNull();
  });

  it('stops chopping once its hands are full, and takes no gather order then', () => {
    const small = {
      ...content,
      heroes: { placeholder: { ...content.heroes.placeholder, carryCapacity: 2 } },
    };
    const s0 = createInitialState(1, clearing, small);
    const tree = treeAt(s0, 5, 1);
    const gather: Command = { type: 'orderHero', order: 'gather', tree };
    let s = step(s0, [gather], small);
    while (!idle(s) && s.tick < 1000) s = step(s, [], small);
    expect(hero(s)?.carrying).toEqual({ resource: 'logs', amount: 2 });
    expect(s.components.mapObject[tree]?.amount).toBe(1);

    const again = step(s, [gather], small);
    expect(hero(again)?.order).toBeNull();
    expect(again.components.path[heroId(again)]).toBeUndefined();
  });
});
