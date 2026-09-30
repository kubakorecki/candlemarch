// Clearing a Den by day: the Hero's attack order, the Den's sting, the cache it leaves and the
// calm around it.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { canPlaceStockpile } from '../src/stockpiles';
import { content, run, runUntil } from './helpers';

const WIDTH = 30;
const HEIGHT = 9;
const DEN = { x: 20, y: 4 };

/** Open Meadow with a Den (`D`) on each of `dens`. */
function rows(dens: Tile[], width = WIDTH, height = HEIGHT): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      dens.some((d) => d.x === x && d.y === y) ? 'D' : '.',
    ).join(''),
  );
}

/**
 * A field on spring day 1, 100 ticks after Dawn: a Den (ID 1) at `DEN` and the Hero (ID 2) at
 * `hero`, then whatever `map` adds.
 */
function field(hero: Tile = { x: 17, y: 4 }, map: Partial<MapDef> = {}): GameState {
  const s = createInitialState(
    1,
    { name: 'field', rows: rows([DEN]), buildings: [], villagers: [], hero, ...map },
    content,
  );
  s.tick = 100;
  return s;
}

const HERO = 2;
const attackDen: Command = { type: 'orderHero', order: 'attackDen', den: 1 };

/** Runs `s` with the Hero ordered at the Den until the Den is cleared. */
function cleared(s: GameState): GameState {
  return runUntil(s, (x) => x.components.den[1] === undefined, 1000, { [s.tick]: [attackDen] });
}

describe('attacking a Den', () => {
  it('is what right-clicking a Den orders the Hero', () => {
    expect(heroOrderAt(field(), content, DEN)).toEqual({ order: 'attackDen', den: 1 });
  });

  it('clears it: the Den is gone and leaves a cache of hides and firewood on its tile', () => {
    const s = cleared(field());
    expect(s.components.den).toEqual({});
    const caches = idsOf(s.components.cache);
    expect(caches).toHaveLength(1);
    const cache = caches[0] as EntityId;
    expect(s.components.tile[cache]).toEqual(DEN);
    expect(s.components.cache[cache]).toEqual({ stock: { hides: 4, firewood: 6 } });
    expect(s.components.hero[HERO]?.order).toBeNull();
  });
});

describe('a cleared Den', () => {
  it('sends out no more Gloamlings', () => {
    const atDusk = (s: GameState) => {
      s.tick = duskTick(1, content);
      return idsOf(run(s, 1).components.gloamling);
    };
    expect(atDusk(field())).toHaveLength(1);
    expect(atDusk(cleared(field()))).toEqual([]);
  });

  it('stings back while the Hero hits it: 8 hits of 10 against 8 stings of 5', () => {
    const s = cleared(field());
    expect(s.components.hero[HERO]?.hp).toBe(60);
  });

  it("leaves a cache Carriers haul to a stockpile, gone once it's empty", () => {
    // A stockpile (ID 2) just east of the Den and a Carrier (ID 3); the Hero is ID 4.
    const s = cleared(
      field(
        { x: 17, y: 4 },
        { stockpiles: [{ x: 22, y: 3, w: 3, h: 3 }], villagers: [{ job: 'carrier', x: 21, y: 7 }] },
      ),
    );
    const done = runUntil(
      s,
      (x) => idsOf(x.components.cache).length === 0 && x.logistics.hauls[3] === undefined,
      1500,
    );
    expect(done.components.cache).toEqual({});
    const piled = Object.values(done.components.stockpile[2]?.goods ?? {});
    const total = (resource: string) =>
      piled.filter((g) => g.resource === resource).reduce((sum, g) => sum + g.amount, 0);
    expect(total('hides')).toBe(4);
    expect(total('firewood')).toBe(6);
  });

  it('leaves a cache the Hero can pick up', () => {
    const s = cleared(field());
    const cache = idsOf(s.components.cache)[0] as EntityId;
    expect(heroOrderAt(s, content, DEN)).toEqual({ order: 'pickup', source: cache });
    const done = run(s, 100, {
      [s.tick]: [{ type: 'orderHero', order: 'pickup', source: cache }],
    });
    // Firewood comes before hides in content order; the Hero carries 5.
    expect(done.components.hero[HERO]?.carrying).toEqual({ resource: 'firewood', amount: 5 });
    expect(done.components.cache[cache]?.stock).toEqual({ hides: 4, firewood: 1 });
  });

  it('keeps buildings and stockpiles off its cache', () => {
    const s = cleared(field());
    expect(canPlaceBuilding(s, content, 'hut', DEN.x, DEN.y)).toBe(false);
    expect(canPlaceStockpile(s, content, DEN.x, DEN.y, 1, 1)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', DEN.x, DEN.y - 2)).toBe(true);
  });
});

describe("the Den's sting", () => {
  it('can knock the Hero out, which ends the order', () => {
    const s = field();
    (s.components.hero[HERO] as { hp: number }).hp = 5;
    const out = runUntil(s, (x) => x.components.hero[HERO]?.knockedOutUntil !== null, 400, {
      [s.tick]: [attackDen],
    });
    expect(out.components.hero[HERO]).toMatchObject({ hp: 0, order: null });
    // The Den stings first (lower ID): the Hero never landed a hit.
    expect(out.components.den[1]?.hp).toBe(80);
    // A Knocked-out Hero isn't stung again.
    expect(run(out, 100).components.hero[HERO]?.hp).toBe(0);
  });

  it('hurts a villager standing next to the Den, and can kill it', () => {
    // A Carrier (ID 2) next to the Den, with nothing to do; the Hero (ID 3) is out of reach.
    const s = field({ x: 10, y: 4 }, { villagers: [{ job: 'carrier', x: 21, y: 4 }] });
    expect(run(s, 1).components.villager[2]?.hp).toBe(15);
    const dead = runUntil(s, (x) => x.deaths.length > 0, 200);
    expect(dead.deaths).toEqual([expect.objectContaining({ cause: 'den' })]);
  });
});

describe('the calm round a cleared Den', () => {
  const WIDE = 40;
  const TALL = 13;
  const cleared = { x: 15, y: 6 };
  const parent = { x: 38, y: 6 };

  /**
   * 40×13 Meadow with a Hut at (1,6), a Den (ID 1) at (15,6) the Hero (ID 4) clears on day 1 with
   * one hit, and a Den (ID 2) at (38,6) whose buds fit on x 28–32. The calm (15 tiles) covers x
   * up to 30.
   */
  function calmed(seed: number, clear = true): GameState {
    const s = createInitialState(
      seed,
      {
        name: 'wilds',
        rows: rows([cleared, parent], WIDE, TALL),
        buildings: [{ type: 'hut', x: 1, y: 6 }],
        villagers: [],
        hero: { x: 16, y: 6 },
      },
      content,
    );
    s.tick = 100;
    if (!clear) return s;
    (s.components.den[1] as { hp: number }).hp = 10;
    const done = run(s, 2, { 100: [{ type: 'orderHero', order: 'attackDen', den: 1 }] });
    expect(done.components.den[1]).toBeUndefined();
    return done;
  }

  /** The x of the bud Den 2 puts out at `day`'s Dawn, if any. */
  function budX(s: GameState, day: number): number | undefined {
    s.tick = dawnTick(day, content);
    const after = run(s, 1);
    const bud = idsOf(after.components.den).find((id) => id > 2);
    return bud === undefined ? undefined : after.components.tile[bud]?.x;
  }

  const SEEDS = [1, 2, 3, 4, 5, 6];
  const SUMMER = 6;
  const AUTUMN = 11;
  const WINTER = 16;

  it('keeps buds 16 or more tiles from the cleared Den for 10 days', () => {
    // Uncalmed, some seeds bud inside what would be the calm area.
    expect(SEEDS.some((seed) => (budX(calmed(seed, false), SUMMER) ?? 99) <= 30)).toBe(true);
    for (const day of [SUMMER, AUTUMN]) {
      for (const seed of SEEDS) {
        expect(budX(calmed(seed), day), `seed ${seed}, day ${day}`).toBeGreaterThanOrEqual(31);
      }
    }
  });

  it('ends after 10 days, and its record is dropped', () => {
    expect(calmed(1).calms).toHaveLength(1);
    expect(SEEDS.some((seed) => (budX(calmed(seed), WINTER) ?? 99) <= 30)).toBe(true);
    const s = calmed(1);
    s.tick = dawnTick(WINTER, content);
    expect(run(s, 1).calms).toEqual([]);
  });
});

describe('saves', () => {
  it('continue a Den fight the same after a save and load', () => {
    const start = field();
    const orders = { [start.tick]: [attackDen] };
    const whole = run(start, 400, orders);
    const half = run(start, 150, orders);
    const hp = half.components.den[1]?.hp ?? 0;
    expect(hp).toBeGreaterThan(0);
    expect(hp).toBeLessThan(80);
    const loaded = run(deserialize(serialize(half), content), 250);
    expect(loaded).toEqual(whole);
    expect(whole.components.den).toEqual({});
  });
});
