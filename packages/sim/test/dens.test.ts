// Monster Dens: Gloamlings out from Dusk to Dawn, Dens budding toward the village once a season,
// the dark ring nothing can be built in, and the Monster rate.

import type { Content, LightDef } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { canPlaceBuilding, tileCenter } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { content, run } from './helpers';

const WIDTH = 40;
const HEIGHT = 13;

/** Open Meadow `WIDTH`×`HEIGHT` with a Den (`D`) on each of `dens`. */
function rows(dens: Tile[]): string[] {
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) =>
      dens.some((d) => d.x === x && d.y === y) ? 'D' : '.',
    ).join(''),
  );
}

const HUT_TILE = { x: 1, y: 6 };

/** A Hut at (1,6) (door (1,7)) and Dens far off to the east. Dens get IDs 1, 2... row-major. */
function wilds(dens: Tile[] = [{ x: 38, y: 6 }]): MapDef {
  return {
    name: 'wilds',
    rows: rows(dens),
    buildings: [{ type: 'hut', ...HUT_TILE }],
    villagers: [],
  };
}

function wildsAt(tick: number, dens?: Tile[], monsterRate?: number): GameState {
  const s = createInitialState(1, wilds(dens), content, monsterRate);
  s.tick = tick;
  return s;
}

function gloamlings(s: GameState): number[] {
  return idsOf(s.components.gloamling);
}

function denTiles(s: GameState): Tile[] {
  return idsOf(s.components.den).map((id) => s.components.tile[id] as Tile);
}

function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const SPRING = 1;
const SUMMER = 6;
const AUTUMN = 11;
const WINTER = 16;

describe('Den spawns', () => {
  it('spawn Gloamlings on the Den tile at Dusk, not before', () => {
    const before = run(wildsAt(duskTick(SPRING, content) - 1), 1);
    expect(gloamlings(before)).toEqual([]);
    const s = run(before, 1);
    const [g] = gloamlings(s);
    expect(gloamlings(s)).toHaveLength(1);
    expect(s.components.gloamling[g as number]).toEqual({
      den: 1,
      hp: 20,
      readyAt: 0,
      target: null,
    });
    expect(s.components.position[g as number]).toEqual(tileCenter({ x: 38, y: 6 }));
    // No more come out later in the night.
    expect(gloamlings(run(s, 100))).toHaveLength(1);
  });

  it('spawn more as the seasons turn: 1, 2, 3, 4 a Den', () => {
    const dens = [
      { x: 38, y: 2 },
      { x: 38, y: 10 },
    ];
    const at = (day: number) => gloamlings(run(wildsAt(duskTick(day, content), dens), 1)).length;
    expect([SPRING, SUMMER, AUTUMN, WINTER].map(at)).toEqual([2, 4, 6, 8]);
  });

  it('all vanish at Dawn', () => {
    const night = run(wildsAt(duskTick(WINTER, content)), 1);
    expect(gloamlings(night)).toHaveLength(4);
    night.tick = dawnTick(WINTER + 1, content);
    const s = run(night, 1);
    expect(gloamlings(s)).toEqual([]);
    expect(Object.keys(s.components.position)).toEqual([]);
  });
});

describe('Monster rate', () => {
  it('scales each Dusk’s spawns, rounding down', () => {
    const at = (day: number, rate: number) =>
      gloamlings(run(wildsAt(duskTick(day, content), undefined, rate), 1)).length;
    expect(at(WINTER, 50)).toBe(2);
    expect(at(WINTER, 30)).toBe(1);
    expect(at(SPRING, 99)).toBe(0);
    expect(at(WINTER, 0)).toBe(0);
  });

  it('is 100 unless a game is started with another', () => {
    expect(wildsAt(0).monsterRate).toBe(100);
    expect(wildsAt(0, undefined, 40).monsterRate).toBe(40);
    expect(() => wildsAt(0, undefined, 101)).toThrow();
    expect(() => wildsAt(0, undefined, 2.5)).toThrow();
  });

  it('changes mid-game by command; at 0 the Gloamlings out vanish at once', () => {
    const night = run(wildsAt(duskTick(WINTER, content)), 1);
    const s = run(night, 1, { [night.tick]: [{ type: 'setMonsterRate', rate: 0 }] });
    expect(s.monsterRate).toBe(0);
    expect(gloamlings(s)).toEqual([]);
    const back = run(s, 1, { [s.tick]: [{ type: 'setMonsterRate', rate: 50 }] });
    expect(back.monsterRate).toBe(50);
  });

  it('ignores a rate outside 0–100 or not whole', () => {
    const s = wildsAt(0);
    for (const rate of [-1, 101, 12.5]) {
      expect(run(s, 1, { 0: [{ type: 'setMonsterRate', rate }] }).monsterRate).toBe(100);
    }
  });

  it('is 100 in a save made before it existed', () => {
    const s = wildsAt(0);
    const old = JSON.parse(serialize(s));
    delete old.monsterRate;
    delete old.components.den;
    delete old.components.gloamling;
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.monsterRate).toBe(100);
    expect(loaded.components.gloamling).toEqual({});
  });
});

describe('Den budding', () => {
  it('buds once at the start of each season, closer to the village', () => {
    const parent = { x: 38, y: 6 };
    // No bud on the first day, nor at a Dawn inside a season.
    expect(denTiles(run(wildsAt(0), 1))).toEqual([parent]);
    expect(denTiles(run(wildsAt(dawnTick(SPRING + 1, content)), 1))).toEqual([parent]);

    const s = run(wildsAt(dawnTick(SUMMER, content)), 1);
    const tiles = denTiles(s);
    expect(tiles).toHaveLength(2);
    const bud = tiles[1] as Tile;
    const closer = chebyshev(parent, HUT_TILE) - chebyshev(bud, HUT_TILE);
    expect(closer).toBeGreaterThanOrEqual(6);
    expect(closer).toBeLessThanOrEqual(10);
    expect(chebyshev(bud, HUT_TILE)).toBeGreaterThanOrEqual(12);
    expect(chebyshev(bud, parent)).toBeLessThanOrEqual(10);
  });

  it('picks among the fitting tiles with the seeded PRNG', () => {
    const budOf = (seed: number) => {
      const s = createInitialState(seed, wilds(), content);
      s.tick = dawnTick(SUMMER, content);
      return denTiles(run(s, 1))[1];
    };
    const buds = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(budOf(seed))));
    expect(buds.size).toBeGreaterThan(1);
    expect(budOf(3)).toEqual(budOf(3));
  });

  it('stops at 5 Dens', () => {
    const four = [2, 4, 6, 8].map((y) => ({ x: 38, y }));
    expect(denTiles(run(wildsAt(dawnTick(SUMMER, content), four), 1))).toHaveLength(5);
    const five = [2, 4, 6, 8, 10].map((y) => ({ x: 38, y }));
    expect(denTiles(run(wildsAt(dawnTick(SUMMER, content), five), 1))).toHaveLength(5);
  });

  it('needs room at least 12 tiles from every building', () => {
    // 16 tiles out: 6 closer would put the bud 10 tiles from the Hut.
    const near = [{ x: 17, y: 6 }];
    expect(denTiles(run(wildsAt(dawnTick(SUMMER, content), near), 1))).toEqual(near);
  });

  it('only picks tiles no light reaches, lit tonight or not', () => {
    // A brazier reaching 29 tiles leaves x 31–32 of the fitting x 28–32 dark.
    const brazier = content.buildings.brazier;
    const farLight: Content = {
      ...content,
      buildings: {
        ...content.buildings,
        brazier: { ...brazier, light: { ...(brazier.light as LightDef), radiusTiles: 29 } },
      },
    };
    const map: MapDef = {
      ...wilds(),
      buildings: [...wilds().buildings, { type: 'brazier', x: 1, y: 2 }],
    };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = createInitialState(seed, map, farLight);
      s.tick = dawnTick(SUMMER, farLight);
      const bud = denTiles(step(s, [], farLight))[1];
      expect(bud, `seed ${seed}`).toBeDefined();
      expect(bud?.x, `seed ${seed}`).toBeGreaterThanOrEqual(31);
    }
  });

  it('stops at Monster rate 0', () => {
    const s = run(wildsAt(dawnTick(SUMMER, content), undefined, 0), 1);
    expect(denTiles(s)).toHaveLength(1);
  });
});

describe('the dark ring', () => {
  it('keeps every building 7 or more tiles from a Den', () => {
    const s = wildsAt(0);
    // A Hut is 1×1: its tile at (31,6) is 7 tiles from the Den at (38,6), at (32,6) only 6.
    expect(canPlaceBuilding(s, content, 'hut', 31, 6)).toBe(true);
    expect(canPlaceBuilding(s, content, 'hut', 32, 6)).toBe(false);
    expect(canPlaceBuilding(s, content, 'hut', 38, 0)).toBe(false);
    const placed = run(s, 1, { 0: [{ type: 'placeBuilding', building: 'hut', x: 32, y: 6 }] });
    expect(placed.components.site).toEqual({});
  });

  it('holds for maps too', () => {
    const map = { ...wilds(), buildings: [{ type: 'hut' as const, x: 33, y: 6 }] };
    expect(() => createInitialState(1, map, content)).toThrow(/doesn't fit/);
  });
});

describe('nights with Dens', () => {
  /** Two Dens, from the last Dusk of spring through summer's first Dawn (spawns, a bud). */
  const start = () =>
    wildsAt(duskTick(5, content), [
      { x: 38, y: 2 },
      { x: 38, y: 10 },
    ]);
  const TICKS = dawnTick(SUMMER, content) - duskTick(5, content) + 2;

  it('are deterministic', () => {
    expect(run(start(), TICKS)).toEqual(run(start(), TICKS));
  });

  it('continue the same after a save and load mid-night', () => {
    const whole = run(start(), TICKS);
    const half = run(start(), 300);
    expect(gloamlings(half)).toHaveLength(2);
    const loaded = run(deserialize(serialize(half), content), TICKS - 300);
    expect(loaded).toEqual(whole);
    expect(denTiles(whole)).toHaveLength(4);
  });
});
