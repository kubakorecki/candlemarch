// Forage patches and the forager's hut: berry bushes and mushroom patches refill each season while
// a tree shades them; a forager gathers from the nearest stocked patch in its hut's radius.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { isWithered } from '../src/forage';
import { heroOrderAt } from '../src/hero';
import { fellTree } from '../src/huntingGrounds';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { content, run } from './helpers';

const bush = content.mapObjects.berry_bush;

/**
 * Trees at (1,1) and (8,1). A berry bush at (3,1) and a mushroom patch at (1,3), both 2 tiles
 * from the first tree; a berry bush at (5,4), 3 tiles from either tree. IDs in row-major order:
 * tree 1, bush 2, tree 3, mushrooms 4, bush 5.
 */
const grove: MapDef = {
  name: 'grove',
  rows: ['..........', '.T.b....T.', '..........', '.m........', '.....b....'],
  buildings: [],
  villagers: [],
};
const TREE = 1;
const SHADED_BUSH = 2;
const SHADED_MUSHROOMS = 4;
const BARE_BUSH = 5;

function amount(s: GameState, id: EntityId): number | undefined {
  return s.components.mapObject[id]?.amount;
}

/** `s` jumped to the Dawn of `day` and run through it. */
function dawnOf(s: GameState, day: number): GameState {
  return run({ ...s, tick: dawnTick(day, content) }, 1);
}

// Seasons are 5 days: spring from day 1, summer 6, autumn 11, winter 16, spring again 21.
describe('forage patches', () => {
  it("start with the first season's stock", () => {
    const s = createInitialState(1, grove, content);
    expect(amount(s, SHADED_BUSH)).toBe(bush.forage?.stock.spring);
    expect(amount(s, SHADED_MUSHROOMS)).toBe(0);
  });

  it("refill to each season's amount at its first Dawn while shaded", () => {
    const s0 = createInitialState(1, grove, content);
    const summer = dawnOf(s0, 6);
    expect(amount(summer, SHADED_BUSH)).toBe(8);
    expect(amount(summer, SHADED_MUSHROOMS)).toBe(0);
    const autumn = dawnOf(summer, 11);
    expect(amount(autumn, SHADED_BUSH)).toBe(0);
    expect(amount(autumn, SHADED_MUSHROOMS)).toBe(8);
    const spring = dawnOf(autumn, 21);
    expect(amount(spring, SHADED_BUSH)).toBe(3);
    expect(amount(spring, SHADED_MUSHROOMS)).toBe(0);
  });

  it("don't refill on other days", () => {
    const s0 = createInitialState(1, grove, content);
    const picked = dawnOf(s0, 6);
    const bushNow = picked.components.mapObject[SHADED_BUSH];
    if (bushNow) bushNow.amount = 1;
    expect(amount(dawnOf(picked, 7), SHADED_BUSH)).toBe(1);
  });

  it('have nothing in winter', () => {
    const s0 = createInitialState(1, grove, content);
    const autumn = dawnOf(s0, 11);
    expect(amount(autumn, SHADED_MUSHROOMS)).toBe(8);
    const winter = dawnOf(autumn, 16);
    expect(amount(winter, SHADED_BUSH)).toBe(0);
    expect(amount(winter, SHADED_MUSHROOMS)).toBe(0);
  });

  it('wither without a tree within 2 tiles: no refill', () => {
    const s0 = createInitialState(1, grove, content);
    expect(isWithered(s0, content, BARE_BUSH)).toBe(true);
    expect(isWithered(s0, content, SHADED_BUSH)).toBe(false);
    expect(amount(dawnOf(s0, 6), BARE_BUSH)).toBe(0);
  });

  it('wither once every tree within 2 tiles is felled', () => {
    const s0 = createInitialState(1, grove, content);
    fellTree(s0, content, TREE);
    expect(isWithered(s0, content, SHADED_BUSH)).toBe(true);
    expect(isWithered(s0, content, SHADED_MUSHROOMS)).toBe(true);
    const summer = dawnOf(s0, 6);
    expect(amount(summer, SHADED_BUSH)).toBe(0);
    expect(amount(dawnOf(summer, 11), SHADED_MUSHROOMS)).toBe(0);
  });

  it('keep whether they have withered in state, for the client to read', () => {
    const s0 = createInitialState(1, grove, content);
    const withered = (s: GameState, id: EntityId) => s.components.mapObject[id]?.withered;
    expect(withered(s0, BARE_BUSH)).toBe(true);
    expect(withered(s0, SHADED_BUSH)).toBe(false);
    expect(withered(s0, TREE)).toBeUndefined();
    fellTree(s0, content, TREE);
    expect(withered(s0, SHADED_BUSH)).toBe(true);
    expect(withered(s0, SHADED_MUSHROOMS)).toBe(true);
  });

  it('get their shade worked out when a save from before it loads', () => {
    const old = JSON.parse(serialize(createInitialState(1, grove, content)));
    for (const obj of Object.values(old.components.mapObject))
      delete (obj as { withered?: boolean }).withered;
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.components.mapObject[BARE_BUSH]?.withered).toBe(true);
    expect(loaded.components.mapObject[SHADED_BUSH]?.withered).toBe(false);
  });

  it('stay when empty, unlike trees', () => {
    const s = dawnOf(createInitialState(1, grove, content), 16);
    expect(idsOf(s.components.mapObject)).toEqual([1, 2, 3, 4, 5]);
  });
});

/**
 * A forager's hut at (2,1) (door (2,2), where the forager starts) and a tree at (4,4) shading
 * everything but the far-west bush. From the door: an empty mushroom patch at (3,3), 1 diagonal
 * away; a withered bush at (0,4), 2 diagonals; a bush at (5,2), 3 tiles; a bush at (6,3), 4.
 * IDs in row-major order: bush 1 (5,2), mushrooms 2 (3,3), bush 3 (6,3), bush 4 (0,4), tree 5,
 * hut 6, forager 7.
 */
const forest: MapDef = {
  name: 'forest',
  rows: ['..........', '..........', '.....b....', '...m..b...', 'b...T.....'],
  buildings: [{ type: 'foragers_hut', x: 2, y: 1 }],
  villagers: [],
};
const NEAR_BUSH = 1;
const EMPTY_MUSHROOMS = 2;
const FAR_BUSH = 3;
const WITHERED_BUSH = 4;
const HUT = 6;
const FORAGER = 7;

function hutStock(s: GameState): Partial<Record<string, number>> {
  return s.components.building[HUT]?.stock ?? {};
}

describe('the forager', () => {
  it('gathers from the nearest patch with stock that has shade', () => {
    const s0 = createInitialState(1, forest, content);
    expect(s0.components.villager[FORAGER]?.job).toBe('forager');
    const s = run(s0, 200);
    expect(amount(s, NEAR_BUSH)).toBeLessThan(3);
    expect(amount(s, FAR_BUSH)).toBe(3);
    expect(amount(s, WITHERED_BUSH)).toBe(3);
    expect(amount(s, EMPTY_MUSHROOMS)).toBe(0);
    expect(hutStock(s).berries).toBe(3 - (amount(s, NEAR_BUSH) ?? 0) - carried(s));
  });

  it('moves on to the next patch once the nearest is empty', () => {
    const s = run(createInitialState(1, forest, content), 1500);
    expect(amount(s, NEAR_BUSH)).toBe(0);
    expect(amount(s, FAR_BUSH)).toBeLessThan(3);
    expect(amount(s, WITHERED_BUSH)).toBe(3);
  });

  it('breaks ties between patches by ID', () => {
    // Bushes at (1,3) and (3,3), both 1 diagonal from the door (2,2), shaded by the tree (2,4).
    const twins: MapDef = { ...forest, rows: ['.....', '.....', '.....', '.b.b.', '..T..'] };
    const s = run(createInitialState(1, twins, content), 200);
    expect(amount(s, 1)).toBeLessThan(3);
    expect(amount(s, 2)).toBe(3);
  });

  it("stays within its hut's work radius", () => {
    const radius = content.buildings.foragers_hut.workRadius ?? 0;
    // A shaded bush one tile beyond the radius east of the hut at (0,1).
    const row = (x: number, char: string) => `${'.'.repeat(x)}${char}`.padEnd(radius + 4, '.');
    const far: MapDef = {
      ...forest,
      rows: ['.'.repeat(radius + 4), row(radius + 1, 'b'), row(radius + 2, 'T')],
      buildings: [{ type: 'foragers_hut', x: 0, y: 1 }],
    };
    const s = run(createInitialState(1, far, content), 600);
    expect(amount(s, 1)).toBe(3);
  });

  it("fills the hut's output buffer, and waits while it's full", () => {
    const s0 = createInitialState(1, forest, content);
    const hut = s0.components.building[HUT];
    const capacity =
      content.buildings.foragers_hut.outputBuffer?.find((b) => b.resource === 'berries')
        ?.capacity ?? 0;
    if (hut) hut.stock.berries = capacity;
    const s = run(s0, 400);
    expect(amount(s, NEAR_BUSH)).toBe(3);
    expect(hutStock(s).berries).toBe(capacity);
  });

  it('abandons a gather at Dusk, but brings what it holds to the hut', () => {
    const s0 = createInitialState(1, forest, content);
    const gathering = run(s0, 400); // well into the day
    const dusk = { ...gathering, tick: duskTick(1, content) };
    const task = dusk.components.forager[FORAGER];
    expect(task).toBeDefined();
    const s = run(dusk, 200);
    expect(s.components.forager[FORAGER]?.kind).toBe('idle');
    expect(s.components.villager[FORAGER]?.carrying).toBeNull();
    const total = (amount(s, NEAR_BUSH) ?? 0) + (hutStock(s).berries ?? 0);
    expect(total).toBe(3);
  });
});

function carried(s: GameState): number {
  return s.components.villager[FORAGER]?.carrying?.amount ?? 0;
}

describe('the hero', () => {
  it("doesn't pick forage patches, only fells trees", () => {
    const s = createInitialState(1, { ...grove, hero: { x: 2, y: 2 } }, content);
    expect(heroOrderAt(s, content, { x: 3, y: 1 })).toBeNull();
    expect(heroOrderAt(s, content, { x: 1, y: 1 })).toEqual({ order: 'gather', tree: TREE });
    const ordered = run(s, 1, { 0: [{ type: 'orderHero', order: 'gather', tree: SHADED_BUSH }] });
    const hero = idsOf(ordered.components.hero)[0] ?? 0;
    expect(ordered.components.hero[hero]?.order).toBeNull();
  });
});

describe("the forager's hut", () => {
  it('supplies the Granary: carriers take its Food there', () => {
    const camp: MapDef = {
      ...forest,
      rows: [...forest.rows, '..........', '..........', '..........'],
      buildings: [...forest.buildings, { type: 'granary', x: 7, y: 5 }],
      villagers: [{ job: 'carrier', x: 8, y: 1 }],
    };
    const s = run(createInitialState(1, camp, content), 1200);
    const granary = idsOf(s.components.building).find(
      (id) => s.components.building[id]?.type === 'granary',
    );
    expect(s.components.building[granary ?? 0]?.stock.berries ?? 0).toBeGreaterThan(0);
  });
});
