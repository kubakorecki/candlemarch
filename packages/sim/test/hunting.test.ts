// Hunting grounds and the hunter's lodge: forest regions holding Game, which hunters catch with a
// chance that follows the Game left, and which logging drives away.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import {
  groundHealth,
  groundsInReach,
  groundsNear,
  huntChancePermille,
} from '../src/huntingGrounds';
import { createInitialState, type MapDef } from '../src/map';
import { randomInt } from '../src/rng';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * An 8-tree wood (4×2, from (1,1)) that is the "Old Wood" Hunting ground, max Game 20. IDs: trees
 * 1–8 in row-major order, then anything else on the map, then the ground.
 */
const wood: MapDef = {
  name: 'wood',
  rows: ['..........', '.TTTT.....', '.TTTT.....', '..........', '..........'],
  buildings: [],
  villagers: [],
  huntingGrounds: [{ name: 'Old Wood', x: 1, y: 1, w: 4, h: 2, maxGame: 20 }],
};

/** The map's (first) Hunting ground. Grounds are created last, so their ID depends on the map. */
function ground(s: GameState, id: EntityId = idsOf(s.components.huntingGround)[0] ?? 0) {
  const g = s.components.huntingGround[id];
  if (!g) throw new Error(`no ground ${id}`);
  return g;
}

describe('hunting grounds', () => {
  it('start full, knowing the trees standing in them', () => {
    const s = createInitialState(1, wood, content);
    expect(idsOf(s.components.huntingGround)).toEqual([9]);
    expect(ground(s)).toMatchObject({ name: 'Old Wood', maxGame: 20, game: 20, startTrees: 8 });
    expect(ground(s).fled).toBe(0);
  });

  it('lose the Game above their new ceiling when a woodcutter fells a tree', () => {
    // A woodcutter's hut south of the wood; its woodcutter fells the nearest tree first.
    const logging: MapDef = {
      ...wood,
      rows: [...wood.rows, '..........'],
      buildings: [{ type: 'woodcutters_hut', x: 2, y: 3 }],
    };
    const s0 = createInitialState(1, logging, content);
    const trees = (x: GameState) =>
      idsOf(x.components.mapObject).filter((id) => x.components.mapObject[id]?.type === 'tree');
    const s = runUntil(s0, (x) => trees(x).length < 8, 2000);
    expect(trees(s).length).toBe(7);
    // Ceiling trunc(20 × 7 / 8) = 17: three flee.
    expect(ground(s).game).toBe(17);
    expect(ground(s).fled).toBe(3);
  });

  it('keep Game already under the new ceiling when the hero fells a tree', () => {
    const hero = { ...wood, hero: { x: 0, y: 1 } };
    const h0 = createInitialState(1, hero, content);
    ground(h0).game = 10;
    const heroId = idsOf(h0.components.hero)[0] ?? 0;
    const tree = 1; // (1,1), next to the hero
    const s = runUntil(
      run(h0, 1, { 0: [{ type: 'orderHero', order: 'gather', tree }] }),
      (x) => !x.components.mapObject[tree],
      2000,
    );
    expect(s.components.hero[heroId]).toBeDefined();
    expect(ground(s).game).toBe(10);
    expect(ground(s).fled).toBe(0);
  });

  it('have a health word from Game ÷ max', () => {
    const s = createInitialState(1, wood, content);
    const at = (game: number) => {
      ground(s).game = game;
      return groundHealth(ground(s), content);
    };
    expect(at(20)).toBe('thriving');
    expect(at(15)).toBe('thriving');
    expect(at(14)).toBe('thinning');
    expect(at(5)).toBe('thinning');
    expect(at(4)).toBe('scarce');
    expect(at(1)).toBe('scarce');
    expect(at(0)).toBe('empty');
  });

  it('give a catch chance of 50% × Game ÷ max, in permille', () => {
    const s = createInitialState(1, wood, content);
    expect(huntChancePermille(ground(s), content)).toBe(500);
    ground(s).game = 12;
    expect(huntChancePermille(ground(s), content)).toBe(300);
    ground(s).game = 1;
    expect(huntChancePermille(ground(s), content)).toBe(25);
    ground(s).game = 0;
    expect(huntChancePermille(ground(s), content)).toBe(0);
  });
});

/**
 * The same 8 trees inside a larger "Old Wood" (6×4 from (0,0), open tiles around the trees), and a
 * hunter's lodge at (7,2) with its door at (7,3), where the hunter starts. IDs: trees 1–8, lodge
 * 9, hunter 10, ground 11.
 */
const camp: MapDef = {
  name: 'camp',
  rows: ['..........', '.TTTT.....', '.TTTT.....', '..........', '..........'],
  buildings: [{ type: 'hunters_lodge', x: 7, y: 2 }],
  villagers: [],
  huntingGrounds: [{ name: 'Old Wood', x: 0, y: 0, w: 6, h: 4, maxGame: 20 }],
};
const LODGE = 9;
const HUNTER = 10;

function clone(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

function lodgeStock(s: GameState): Partial<Record<string, number>> {
  return s.components.building[LODGE]?.stock ?? {};
}

describe('the hunter', () => {
  it('hunts in a ground in reach and brings each catch to the lodge: 4 meat and 1 hide', () => {
    const s0 = createInitialState(1, camp, content);
    expect(s0.components.villager[HUNTER]?.job).toBe('hunter');
    const s = runUntil(s0, (x) => (lodgeStock(x).meat ?? 0) > 0, 2400);
    const caught = 20 - ground(s).game;
    expect(caught).toBe(1);
    expect(lodgeStock(s)).toEqual({ meat: 4, hides: 1 });
  });

  it('catches with a chance that follows the Game left', () => {
    // A PRNG state whose next roll (0–999) is 200–299: a catch at 20 Game (chance 500), a miss at 8
    // (chance 200).
    let rng = 0;
    while (Math.trunc(randomInt({ rng }, 1000) / 100) !== 2) rng += 1;
    const lastTick = runUntil(
      createInitialState(1, camp, content),
      (x) => {
        const t = x.components.hunter[HUNTER];
        return t?.kind === 'hunting' && t.ticksLeft === 1;
      },
      2000,
    );
    const outcome = (game: number) => {
      const s0 = clone(lastTick);
      s0.rng = rng;
      ground(s0).game = game;
      const s = run(s0, 1);
      return { game: ground(s).game, task: s.components.hunter[HUNTER] };
    };
    expect(outcome(20)).toMatchObject({
      game: 19,
      task: {
        kind: 'toLodge',
        bag: [
          { resource: 'meat', amount: 4 },
          { resource: 'hides', amount: 1 },
        ],
      },
    });
    expect(outcome(8)).toMatchObject({ game: 8, task: { kind: 'toLodge', bag: [] } });
  });

  it("doesn't hunt when every ground in reach is empty", () => {
    const s0 = createInitialState(1, camp, content);
    ground(s0).game = 0;
    const s = run(s0, 600);
    expect(s.components.hunter[HUNTER]?.kind).toBe('idle');
    expect(s.components.position[HUNTER]).toEqual(s0.components.position[HUNTER]);
    expect(s.rng).toBe(s0.rng);
    expect(lodgeStock(s)).toEqual({});
  });

  it("doesn't hunt in a ground beyond its lodge's radius", () => {
    const radius = content.buildings.hunters_lodge.workRadius ?? 0;
    // The ground's nearest column is radius + 1 tiles east of the lodge at (0,1).
    const width = radius + 6;
    const far: MapDef = {
      ...camp,
      rows: ['.'.repeat(width), '.'.repeat(width), '.'.repeat(width)],
      buildings: [{ type: 'hunters_lodge', x: 0, y: 1 }],
      huntingGrounds: [{ name: 'Far Wood', x: radius + 1, y: 0, w: 3, h: 3, maxGame: 20 }],
    };
    const s0 = createInitialState(1, far, content);
    const s = run(s0, 600);
    expect(ground(s).game).toBe(20);
    expect(s.components.hunter[2]?.kind).toBe('idle');
    expect(s.components.position[2]).toEqual(s0.components.position[2]);
  });

  it("waits while the lodge's buffer has no room for a catch", () => {
    const s0 = createInitialState(1, camp, content);
    const lodge = s0.components.building[LODGE];
    if (lodge) lodge.stock = { meat: 5 }; // capacity 8: no room for 4 more
    const s = run(s0, 600);
    expect(s.components.hunter[HUNTER]?.kind).toBe('idle');
    expect(s.components.position[HUNTER]).toEqual(s0.components.position[HUNTER]);
  });

  it('hunts on in winter', () => {
    const winter = { ...createInitialState(1, camp, content), tick: dawnTick(16, content) };
    const s = runUntil(winter, (x) => x.components.hunter[HUNTER]?.kind === 'hunting', 1000);
    expect(s.components.hunter[HUNTER]?.kind).toBe('hunting');
  });

  it('abandons a hunt at Dusk, but brings a catch in hand to the lodge', () => {
    const s0 = createInitialState(1, camp, content);
    const hunting = runUntil(s0, (x) => x.components.hunter[HUNTER]?.kind === 'hunting', 1000);
    const dusk = run({ ...hunting, tick: duskTick(1, content) }, 1);
    expect(dusk.components.hunter[HUNTER]?.kind).toBe('idle');
    expect(ground(dusk).game).toBe(20);

    const back = { ...clone(hunting), tick: duskTick(1, content) };
    back.components.hunter[HUNTER] = { kind: 'toLodge', bag: [{ resource: 'meat', amount: 4 }] };
    const s = run(back, 200);
    expect(s.components.hunter[HUNTER]?.kind).toBe('idle');
    expect(lodgeStock(s).meat).toBe(4);
  });

  it('gives the same results for the same seed', () => {
    const a = run(createInitialState(3, camp, content), 3000);
    const b = run(createInitialState(3, camp, content), 3000);
    expect(a).toEqual(b);
  });

  it('continues a hunt after save and load exactly as without', () => {
    const s0 = createInitialState(1, camp, content);
    const hunting = runUntil(s0, (x) => x.components.hunter[HUNTER]?.kind === 'hunting', 1000);
    const midHunt = run(hunting, 50);
    expect(midHunt.components.hunter[HUNTER]?.kind).toBe('hunting');
    const uninterrupted = run(midHunt, 1500);
    expect(run(deserialize(serialize(midHunt), content), 1500)).toEqual(uninterrupted);
  });
});

describe("the hunter's lodge", () => {
  it('supplies the village: carriers take meat to the Granary and hides to a Stockpile', () => {
    const village: MapDef = {
      ...camp,
      rows: [...camp.rows, '..........', '..........', '..........', '..........'],
      buildings: [...camp.buildings, { type: 'granary', x: 7, y: 5 }],
      stockpiles: [{ x: 1, y: 6, w: 2, h: 2 }],
      villagers: [{ job: 'carrier', x: 8, y: 1 }],
    };
    const s0 = createInitialState(1, village, content);
    ground(s0).game = 0; // the hunter stays home; only the catch already in the lodge moves
    const lodge = s0.components.building[LODGE];
    if (lodge) lodge.stock = { meat: 4, hides: 1 };
    const s = run(s0, 1200);
    const stored = (type: string) => {
      const id = idsOf(s.components.building).find((b) => s.components.building[b]?.type === type);
      return s.components.building[id ?? 0]?.stock ?? {};
    };
    const piled = Object.values(s.components.stockpile).flatMap((p) => Object.values(p.goods));
    expect(stored('granary')).toEqual({ meat: 4 });
    expect(piled).toEqual([{ resource: 'hides', amount: 1 }]);
  });
});

describe('reach', () => {
  it('a building reaches the grounds with a tile within its work radius of its footprint', () => {
    const s = createInitialState(1, camp, content);
    const radius = content.buildings.woodcutters_hut.workRadius ?? 0;
    // The Old Wood's east edge is x = 5; a 2×2 woodcutter's hut at x reaches it within radius.
    expect(groundsNear(s, content, 'woodcutters_hut', { x: 5 + radius, y: 0 })).toEqual([11]);
    expect(groundsNear(s, content, 'woodcutters_hut', { x: 6 + radius, y: 0 })).toEqual([]);
    expect(groundsInReach(s, content, LODGE)).toEqual([11]);
  });
});
