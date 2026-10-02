// Points of interest in play: the Hero's Search of a Ruins, and the Shrine that keeps Dens from
// budding near it. Where the generator puts them is `valley.test.ts`.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { heroOrderAt, heroSearch } from '../src/hero';
import { createInitialState } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { canPlaceStockpile } from '../src/stockpiles';
import { COIN } from '../src/treasury';
import { content, run, runUntil } from './helpers';

/** Open Meadow `width`×`height` with `chars` placed at their tiles. */
function rows(width: number, height: number, chars: [Tile, string][]): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) => chars.find(([t]) => t.x === x && t.y === y)?.[1] ?? '.',
    ).join(''),
  );
}

const RUINS_TILE = { x: 20, y: 4 };
const RUINS = 1;
const HERO = 2;

/** A 30×9 field at `tick`: Ruins (ID 1) at (20,4) and the Hero (ID 2) at (17,4). */
function field(tick = 100): GameState {
  const s = createInitialState(
    1,
    {
      name: 'ruins field',
      rows: rows(30, 9, [[RUINS_TILE, 'R']]),
      buildings: [],
      villagers: [],
      hero: { x: 17, y: 4 },
    },
    content,
  );
  s.tick = tick;
  return s;
}

const search: Command = { type: 'orderHero', order: 'search', ruins: RUINS };

function searched(s: GameState): boolean {
  return s.components.poi[RUINS]?.searched === true;
}

function heroOnRuins(s: GameState): boolean {
  const at = s.components.position[HERO];
  const path = s.components.path[HERO];
  return !path && at?.x === RUINS_TILE.x * 1000 + 500 && at.y === RUINS_TILE.y * 1000 + 500;
}

/**
 * Steps `s` one tick at a time, with a Search ordered on its first, until the Ruins is Searched;
 * counts the ticks that end with the Hero on it.
 */
function ticksOnRuins(s: GameState, max = 1000): { s: GameState; ticks: number } {
  let ticks = 0;
  let x = s;
  for (let i = 0; i < max && !searched(x); i++) {
    x = run(x, 1, { [s.tick]: [search] });
    if (heroOnRuins(x)) ticks += 1;
  }
  return { s: x, ticks };
}

function caches(s: GameState): EntityId[] {
  return idsOf(s.components.cache);
}

describe('Searching Ruins', () => {
  it('is what right-clicking a Ruins orders the Hero by day; by night the Hero just walks there', () => {
    expect(heroOrderAt(field(), content, RUINS_TILE)).toEqual({ order: 'search', ruins: RUINS });
    const night = field(duskTick(1, content) + 10);
    expect(heroOrderAt(night, content, RUINS_TILE)).toEqual({ order: 'move', ...RUINS_TILE });
  });

  it('takes 200 ticks on the tile, then leaves a Cache of firewood, hides and tools, ±30%', () => {
    const { s, ticks } = ticksOnRuins(field());
    expect(ticks).toBe(200);
    expect(searched(s)).toBe(true);
    expect(s.components.hero[HERO]?.order).toBeNull();
    const [cache] = caches(s);
    expect(caches(s)).toHaveLength(1);
    expect(s.components.tile[cache as EntityId]).toEqual(RUINS_TILE);
    const stock = s.components.cache[cache as EntityId]?.stock ?? {};
    expect(Object.keys(stock).sort()).toEqual(['firewood', 'hides', 'tools']);
    // 15 ± 4 firewood, 6 ± 1 hides, 2 ± 0 tools (30%, rounded down).
    expect(stock.firewood).toBeGreaterThanOrEqual(11);
    expect(stock.firewood).toBeLessThanOrEqual(19);
    expect(stock.hides).toBeGreaterThanOrEqual(5);
    expect(stock.hides).toBeLessThanOrEqual(7);
    expect(stock.tools).toBe(2);
  });

  it('puts 50 coin ± 15 straight into the Treasury', () => {
    const before = field();
    expect(before.treasury).toBe(0);
    const { s } = ticksOnRuins(before);
    expect(s.treasury % COIN).toBe(0);
    expect(s.treasury).toBeGreaterThanOrEqual(35 * COIN);
    expect(s.treasury).toBeLessThanOrEqual(65 * COIN);
  });

  it('rolls the Cache with the seeded PRNG: the same for the same seed, varied across seeds', () => {
    const cacheFor = (seed: number) => {
      const s = field();
      s.rng = seed;
      const done = runUntil(s, searched, 1000, { 100: [search] });
      const cache = done.components.cache[caches(done)[0] as EntityId];
      return JSON.stringify({ cache, treasury: done.treasury });
    };
    expect(cacheFor(5)).toBe(cacheFor(5));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(cacheFor)).size).toBeGreaterThan(1);
  });

  it('shows how far it has got, once the Hero stands on the Ruins', () => {
    const walking = run(field(), 2, { 100: [search] });
    expect(heroSearch(walking, content)).toBeNull();
    const s = runUntil(walking, heroOnRuins, 200);
    const started = heroSearch(s, content);
    expect(started?.ruins).toBe(RUINS);
    // 50 ticks later: a quarter more of 200.
    const later = heroSearch(run(s, 50), content);
    expect((later?.percent ?? 0) - (started?.percent ?? 0)).toBe(25);
    expect(heroSearch(runUntil(s, searched, 300), content)).toBeNull();
  });

  it('happens once: a Searched Ruins takes no more Search orders', () => {
    const s = runUntil(field(), searched, 1000, { 100: [search] });
    // Right-clicking it now picks up the Cache.
    expect(heroOrderAt(s, content, RUINS_TILE)).toEqual({ order: 'pickup', source: caches(s)[0] });
    const again = run(s, 300, { [s.tick]: [search] });
    expect(again.components.hero[HERO]?.order).toBeNull();
    expect(caches(again)).toHaveLength(1);
  });

  it('only by day: refused at night, and Dusk ends one under way', () => {
    const night = field(duskTick(1, content) + 10);
    const refused = run(night, 1, { [night.tick]: [search] });
    expect(refused.components.hero[HERO]?.order).toBeNull();

    // Ordered 150 ticks before Dusk: 3 tiles' walk, then under 150 ticks on the Ruins, then Dusk.
    const late = field(duskTick(1, content) - 150);
    const s = run(late, 151, { [late.tick]: [search] });
    expect(s.components.hero[HERO]?.order).toBeNull();
    expect(searched(s)).toBe(false);
    expect(caches(s)).toEqual([]);

    // Next morning it starts over: the full 200 ticks.
    const morning = s;
    morning.tick = dawnTick(2, content) + 10;
    const { ticks } = ticksOnRuins(morning);
    expect(ticks).toBe(200);
  });

  it('starts over when another order interrupts it', () => {
    const s = run(field(), 120, { 100: [search] });
    expect(heroOnRuins(s)).toBe(true);
    const away = runUntil(s, (x) => !x.components.path[HERO] && !heroOnRuins(x), 200, {
      [s.tick]: [{ type: 'orderHero', order: 'move', x: 18, y: 4 }],
    });
    expect(searched(away)).toBe(false);
    const { ticks } = ticksOnRuins(away);
    expect(ticks).toBe(200);
  });

  it('ends if the Hero is Knocked out', () => {
    // A Den beside the Ruins stings the Hero, who has 5 HP left, once it stands on them.
    const s = createInitialState(
      1,
      {
        name: 'stung',
        rows: rows(30, 9, [
          [RUINS_TILE, 'R'],
          [{ x: 21, y: 4 }, 'D'],
        ]),
        buildings: [],
        villagers: [],
        hero: { x: 17, y: 4 },
      },
      content,
    );
    s.tick = 100;
    const hero = 3;
    (s.components.hero[hero] as { hp: number }).hp = 5;
    const out = runUntil(s, (x) => x.components.hero[hero]?.knockedOutUntil != null, 400, {
      100: [search],
    });
    expect(out.components.hero[hero]?.knockedOutUntil).not.toBeNull();
    expect(out.components.hero[hero]?.order).toBeNull();
    expect(searched(out)).toBe(false);
  });

  it('carries on the same after a save and load', () => {
    const s = run(field(), 150, { 100: [search] });
    const straight = runUntil(s, searched, 1000);
    const loaded = runUntil(deserialize(serialize(s), content), searched, 1000);
    expect(loaded).toEqual(straight);
  });
});

describe('a point of interest', () => {
  it('keeps buildings and Stockpiles off its tile', () => {
    const s = field();
    expect(canPlaceBuilding(s, content, 'hut', RUINS_TILE.x, RUINS_TILE.y)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', RUINS_TILE.x, RUINS_TILE.y + 1)).toBe(true);
    expect(canPlaceStockpile(s, content, RUINS_TILE.x - 1, RUINS_TILE.y - 1, 2, 2)).toBe(false);
    expect(canPlaceStockpile(s, content, RUINS_TILE.x + 1, RUINS_TILE.y, 2, 2)).toBe(true);
  });
});

describe('a Shrine', () => {
  // A Hut at (1,6); the Den at (38,6) buds on x 28–32 (6–10 closer to the Hut).
  const HUT = { x: 1, y: 6 };
  const DEN = { x: 38, y: 6 };

  function wildsWithShrine(seed: number, shrine: Tile): GameState {
    const s = createInitialState(
      seed,
      {
        name: 'shrine wilds',
        rows: rows(40, 13, [
          [DEN, 'D'],
          [shrine, 'S'],
        ]),
        buildings: [{ type: 'hut', ...HUT }],
        villagers: [],
      },
      content,
    );
    s.tick = dawnTick(6, content); // summer's first Dawn: Dens bud
    return s;
  }

  function buds(s: GameState): Tile[] {
    return idsOf(s.components.den)
      .map((id) => s.components.tile[id] as Tile)
      .filter((t) => t.x !== DEN.x || t.y !== DEN.y);
  }

  it('keeps Dens from budding within 12 tiles of it', () => {
    // A Shrine at (18,6) wards x up to 30: only x 31–32 are left.
    const shrine = { x: 18, y: 6 };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const [bud] = buds(run(wildsWithShrine(seed, shrine), 1));
      expect(bud, `seed ${seed}`).toBeDefined();
      const d = Math.max(
        Math.abs((bud as Tile).x - shrine.x),
        Math.abs((bud as Tile).y - shrine.y),
      );
      expect(d, `seed ${seed}`).toBeGreaterThan(12);
    }
  });

  it('stops a Den budding at all when it wards every tile it could bud on', () => {
    expect(buds(run(wildsWithShrine(1, { x: 30, y: 6 }), 1))).toEqual([]);
  });
});
