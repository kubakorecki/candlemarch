// The forester's lodge and Saplings: a forester plants Saplings on empty Meadow in its lodge's
// radius; a Sapling grows into a tree in about a year, and only then can it be felled, block
// walking or count as a standing tree.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { isWithered } from '../src/forage';
import { plantSapling } from '../src/forest';
import {
  blockedGrid,
  canPlaceBuilding,
  objectSpeedGrid,
  occupiedGrid,
  tileIndex,
} from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { fellTree, groundCeiling } from '../src/huntingGrounds';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { content, run } from './helpers';

const lodge = content.buildings.foresters_lodge;
const plants = lodge.plants;
const sapling = content.mapObjects.sapling;
const radius = lodge.workRadius ?? 0;

/** Map objects of `type`, as "x,y" strings in ID order. */
function tilesOf(s: GameState, type: string): string[] {
  return idsOf(s.components.mapObject)
    .filter((id) => s.components.mapObject[id]?.type === type)
    .map((id) => {
      const t = s.components.tile[id] as Tile;
      return `${t.x},${t.y}`;
    });
}

/** `s` jumped to the Dawn of `day` and run through it. */
function dawnOf(s: GameState, day: number, c: Content = content): GameState {
  return run({ ...s, tick: dawnTick(day, c) }, 1, {}, c);
}

/**
 * A 16×16 glade with the lodge at (7,7) (door (7,8)) and, inside its radius: a tree at (4,4), a
 * Dirt path along row 10 from x 3 to 11, a Stockpile at (10,4)–(11,5), Rock at (4,10) and (2,12).
 */
const glade: MapDef = {
  name: 'glade',
  rows: [
    '................',
    '................',
    '................',
    '................',
    '....T...........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...=:=====......',
    '................',
    '..:.............',
    '................',
    '................',
    '................',
  ],
  buildings: [{ type: 'foresters_lodge', x: 7, y: 7 }],
  stockpiles: [{ x: 10, y: 4, w: 2, h: 2 }],
  villagers: [],
};

/** The (first) forester's ID. */
function foresterOf(s: GameState): EntityId {
  const id = idsOf(s.components.villager).find((v) => s.components.villager[v]?.job === 'forester');
  if (id === undefined) throw new Error('no forester');
  return id;
}

describe("the forester's lodge", () => {
  it('employs a forester who plants Saplings as the day goes on', () => {
    const s0 = createInitialState(1, glade, content);
    expect(s0.components.forester[foresterOf(s0)]).toEqual({ kind: 'idle', retryAt: 0 });
    const s = run(s0, 2000);
    expect(tilesOf(s, 'sapling').length).toBeGreaterThan(3);
  });

  it('plants only on empty Meadow in its radius, a tile apart, off doors and the entry', () => {
    const s = run(createInitialState(1, { ...glade, entry: { x: 8, y: 0 } }, content), 2400);
    const planted = tilesOf(s, 'sapling');
    expect(planted.length).toBeGreaterThan(3);
    const taken = new Set(['4,4', '4,10', '2,12', '7,8', '8,0', '10,4', '11,4', '10,5', '11,5']);
    for (const at of planted) {
      const [x, y] = at.split(',').map(Number) as [number, number];
      expect(Math.max(Math.abs(x - 7), Math.abs(y - 7)), at).toBeLessThanOrEqual(radius);
      expect(x % (plants?.spacing ?? 1), at).toBe(0);
      expect(y % (plants?.spacing ?? 1), at).toBe(0);
      expect(taken.has(at), at).toBe(false);
      expect(y === 10 && x >= 3 && x <= 9, `${at} on the path`).toBe(false);
    }
  });

  it('fills its radius, then waits for room', () => {
    // A radius of 2 round the lodge: x and y 5–9, so Saplings at (6,6), (8,6), (6,8), (8,8)
    // (with spacing 2), none on the lodge (7,7) nor its door (7,8).
    const small: Content = {
      ...content,
      buildings: { ...content.buildings, foresters_lodge: { ...lodge, workRadius: 2 } },
    };
    const open: MapDef = { ...glade, rows: glade.rows.map((r) => '.'.repeat(r.length)) };
    const s = run(createInitialState(1, { ...open, stockpiles: [] }, small), 2400, {}, small);
    expect(tilesOf(s, 'sapling').sort()).toEqual(['6,6', '6,8', '8,6', '8,8']);
    expect(s.components.forester[foresterOf(s)]?.kind).toBe('idle');
  });
});

/** An open 12×7 field with a berry bush at (3,3); IDs: bush 1, then whatever a test adds. */
const field: MapDef = {
  name: 'field',
  rows: ['............', '............', '............', '...b........', '............'],
  buildings: [],
  villagers: [],
};

function saplingAt(s: GameState, tile: Tile): EntityId {
  const id = plantSapling(s, content, tile);
  if (id === null) throw new Error(`no sapling at ${tile.x},${tile.y}`);
  return id;
}

describe('Saplings', () => {
  it('grow into a tree at the first Dawn a year after planting, through stages', () => {
    const s0 = createInitialState(1, field, content);
    const id = saplingAt(s0, { x: 8, y: 2 });
    expect(s0.components.mapObject[id]).toMatchObject({ type: 'sapling', amount: 0, stage: 0 });
    const days = sapling.grows?.days ?? 0;
    expect(days).toBe(20); // about a year of 4 × 5 days
    // Planted at tick 0 (day 1's Dawn): still a Sapling at day 20's Dawn, halfway there by day 11.
    const half = dawnOf(s0, 11);
    expect(half.components.mapObject[id]).toMatchObject({ type: 'sapling', stage: 1 });
    const before = dawnOf(half, days);
    expect(before.components.mapObject[id]).toMatchObject({ type: 'sapling', stage: 2 });
    const grown = dawnOf(before, days + 1);
    expect(grown.components.mapObject[id]).toEqual({
      type: 'tree',
      amount: content.mapObjects.tree.amount,
    });
  });

  it("are walked over at full speed and built on until they're trees", () => {
    const s0 = createInitialState(1, field, content);
    const id = saplingAt(s0, { x: 8, y: 2 });
    const i = tileIndex(s0.map, 8, 2);
    expect(blockedGrid(s0, content)[i]).toBe(0);
    expect(objectSpeedGrid(s0, content)[i]).toBe(0);
    expect(occupiedGrid(s0, content)[i]).toBe(0);
    const grown = dawnOf(s0, 1 + (sapling.grows?.days ?? 0));
    expect(grown.components.mapObject[id]?.type).toBe('tree');
    expect(objectSpeedGrid(grown, content)[i]).toBe(content.mapObjects.tree.walkSpeedPercent);
    expect(occupiedGrid(grown, content)[i]).toBe(1);
  });

  it("can't be felled until they're trees", () => {
    const withHero: MapDef = { ...field, hero: { x: 6, y: 2 } };
    const s0 = createInitialState(1, withHero, content);
    const id = saplingAt(s0, { x: 8, y: 2 });
    // Right-clicking a Sapling walks the Hero onto it; a chop order for it is ignored.
    expect(heroOrderAt(s0, content, { x: 8, y: 2 })).toEqual({ order: 'move', x: 8, y: 2 });
    const s = run(s0, 200, { 0: [{ type: 'orderHero', order: 'gather', tree: id }] });
    expect(s.components.mapObject[id]).toMatchObject({ type: 'sapling' });
    // Once grown it's fair game.
    const grown = dawnOf(s0, 1 + (sapling.grows?.days ?? 0));
    expect(heroOrderAt(grown, content, { x: 8, y: 2 })).toEqual({ order: 'gather', tree: id });
  });

  it('are left alone by woodcutters until they grow', () => {
    const logging: MapDef = { ...field, buildings: [{ type: 'woodcutters_hut', x: 5, y: 1 }] };
    const s0 = createInitialState(1, logging, content);
    const id = saplingAt(s0, { x: 8, y: 2 });
    const s = run(s0, 600);
    expect(s.components.mapObject[id]?.type).toBe('sapling');
    expect(s.components.woodcutter[3]?.kind).toBe('idle');
  });

  it('give no shade until they grow: a bush with only a Sapling near it withers', () => {
    const s0 = createInitialState(1, field, content);
    expect(isWithered(s0, content, 1)).toBe(true);
    saplingAt(s0, { x: 4, y: 3 });
    expect(isWithered(s0, content, 1)).toBe(true);
    const grown = dawnOf(s0, 1 + (sapling.grows?.days ?? 0));
    expect(isWithered(grown, content, 1)).toBe(false);
  });

  it("raise a Hunting ground's ceiling again only once grown", () => {
    const wood: MapDef = {
      ...field,
      rows: ['TT..........', '............', '............', '............', '............'],
      huntingGrounds: [{ name: 'Copse', x: 0, y: 0, w: 4, h: 2, maxGame: 10 }],
    };
    const s0 = createInitialState(1, wood, content);
    const ceiling = (s: GameState) => {
      const g = s.components.huntingGround[3];
      if (!g) throw new Error('no ground');
      return groundCeiling(s, content, g);
    };
    fellTree(s0, content, 2);
    expect(ceiling(s0)).toBe(5);
    saplingAt(s0, { x: 2, y: 0 });
    expect(ceiling(s0)).toBe(5);
    expect(ceiling(dawnOf(s0, sapling.grows?.days ?? 0))).toBe(5);
    expect(ceiling(dawnOf(s0, 1 + (sapling.grows?.days ?? 0)))).toBe(10);
  });

  it('are cleared by a building, Road or Stockpile put on their tile', () => {
    const s0 = createInitialState(1, field, content);
    const under = saplingAt(s0, { x: 8, y: 1 });
    const onDoor = saplingAt(s0, { x: 8, y: 2 });
    const onPath = saplingAt(s0, { x: 10, y: 0 });
    const onPile = saplingAt(s0, { x: 1, y: 0 });
    expect(canPlaceBuilding(s0, content, 'hut', 8, 1)).toBe(true);
    const s = run(s0, 1, {
      0: [
        { type: 'placeBuilding', building: 'hut', x: 8, y: 1 },
        { type: 'layPath', from: { x: 10, y: 0 }, to: { x: 10, y: 1 } },
        { type: 'placeStockpile', x: 0, y: 0, w: 2, h: 1 },
      ],
    });
    for (const id of [under, onDoor, onPath, onPile])
      expect(s.components.mapObject[id]).toBeUndefined();
  });
});

/**
 * A 12×5 field with a tree at (5,2) shading a berry bush at (3,2), a woodcutter's hut at (7,0)
 * (door (8,2)) and a Hero at (1,4). IDs: bush 1, tree 2, hut 3, woodcutter 4, Hero 5.
 */
const clearing: MapDef = {
  name: 'clearing',
  rows: ['............', '............', '...b.T......', '............', '............'],
  buildings: [{ type: 'woodcutters_hut', x: 7, y: 0 }],
  villagers: [],
  hero: { x: 1, y: 4 },
};
const BUSH = 1;
const TREE = 2;
const stump = content.mapObjects.stump;
/** Days from a felling to the tree standing again: a Stump's, then a Sapling's. */
const regrowDays = (stump.grows?.days ?? 0) + (sapling.grows?.days ?? 0);

/** The clearing with its tree felled at the first Dawn (tick 0). */
function felled(): GameState {
  const s = createInitialState(1, clearing, content);
  fellTree(s, content, TREE);
  return s;
}

describe('Stumps', () => {
  it('are left by a felled tree: walked over, giving no shade', () => {
    const s = run(createInitialState(1, clearing, content), 800); // the woodcutter fells it
    expect(s.components.mapObject[TREE]).toMatchObject({ type: 'stump', amount: 0 });
    expect(tilesOf(s, 'stump')).toEqual(['5,2']);
    expect(blockedGrid(s, content)[tileIndex(s.map, 5, 2)]).toBe(0);
    expect(isWithered(s, content, BUSH)).toBe(true);
    // Nothing to chop: right-clicking it walks the Hero there.
    expect(heroOrderAt(s, content, { x: 5, y: 2 })).toEqual({ order: 'move', x: 5, y: 2 });
  });

  it('sprout a Sapling a year later, which grows into a tree that can be felled again', () => {
    expect(stump.grows?.days).toBe(20);
    const s = felled();
    const days = stump.grows?.days ?? 0;
    expect(dawnOf(s, days).components.mapObject[TREE]?.type).toBe('stump');
    const sprouted = dawnOf(s, days + 1);
    expect(sprouted.components.mapObject[TREE]).toMatchObject({ type: 'sapling', stage: 0 });
    expect(isWithered(sprouted, content, BUSH)).toBe(true);
    expect(dawnOf(sprouted, regrowDays).components.mapObject[TREE]?.type).toBe('sapling');
    const grown = dawnOf(sprouted, regrowDays + 1);
    expect(grown.components.mapObject[TREE]).toEqual({
      type: 'tree',
      amount: content.mapObjects.tree.amount,
    });
    expect(isWithered(grown, content, BUSH)).toBe(false);
    expect(occupiedGrid(grown, content)[tileIndex(grown.map, 5, 2)]).toBe(1);
    expect(heroOrderAt(grown, content, { x: 5, y: 2 })).toEqual({ order: 'gather', tree: TREE });
  });

  it('are cleared by a building, Road or Stockpile put on their tile', () => {
    const wood: MapDef = { ...clearing, rows: ['TT.T........', ...clearing.rows.slice(1)] };
    const s0 = createInitialState(1, wood, content);
    for (const id of [1, 2, 3]) fellTree(s0, content, id);
    expect(tilesOf(s0, 'stump')).toEqual(['0,0', '1,0', '3,0']);
    const s = run(s0, 1, {
      0: [
        { type: 'placeBuilding', building: 'hut', x: 0, y: 0 },
        { type: 'layPath', from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
        { type: 'placeStockpile', x: 3, y: 0, w: 1, h: 1 },
      ],
    });
    expect(tilesOf(s, 'stump')).toEqual([]);
  });

  it("aren't planted on by a forester", () => {
    // The glade's tree at (4,4) is on the forester's planting grid; felled, it leaves a Stump.
    const s0 = createInitialState(1, glade, content);
    fellTree(s0, content, 1);
    const s = run(s0, 2400);
    expect(tilesOf(s, 'sapling').length).toBeGreaterThan(3);
    expect(tilesOf(s, 'sapling')).not.toContain('4,4');
    expect(tilesOf(s, 'stump')).toEqual(['4,4']);
  });

  it("let a Hunting ground's ceiling rise again once the tree has grown back", () => {
    const wood: MapDef = {
      name: 'wood',
      rows: ['TT..........', '............'],
      buildings: [],
      villagers: [],
      huntingGrounds: [{ name: 'Copse', x: 0, y: 0, w: 4, h: 2, maxGame: 10 }],
    };
    const s0 = createInitialState(1, wood, content);
    const ceiling = (s: GameState) => {
      const g = s.components.huntingGround[3];
      if (!g) throw new Error('no ground');
      return groundCeiling(s, content, g);
    };
    fellTree(s0, content, 1);
    expect(ceiling(s0)).toBe(5);
    const sprouted = dawnOf(s0, 1 + (stump.grows?.days ?? 0));
    expect(ceiling(sprouted)).toBe(5);
    expect(ceiling(dawnOf(sprouted, regrowDays))).toBe(5);
    expect(ceiling(dawnOf(sprouted, regrowDays + 1))).toBe(10);
  });

  it('keep growing across a save and load, as if never saved', () => {
    const s = dawnOf(felled(), 25); // sprouted a Sapling this Dawn
    const grownDay = 25 + (sapling.grows?.days ?? 0);
    const straight = dawnOf(s, grownDay);
    const reloaded = dawnOf(deserialize(serialize(s), content), grownDay);
    expect(reloaded).toEqual(straight);
    expect(straight.components.mapObject[TREE]?.type).toBe('tree');
  });
});

describe('forestry', () => {
  it('is deterministic', () => {
    const a = run(createInitialState(7, glade, content), 3000);
    const b = run(createInitialState(7, glade, content), 3000);
    expect(a).toEqual(b);
    expect(tilesOf(a, 'sapling').length).toBeGreaterThan(3);
  });

  it('keeps growing across a save and load', () => {
    const s0 = createInitialState(1, field, content);
    saplingAt(s0, { x: 8, y: 2 });
    const loaded = deserialize(serialize(s0), content);
    const grown = dawnOf(loaded, 1 + (sapling.grows?.days ?? 0));
    expect(tilesOf(grown, 'tree')).toEqual(['8,2']);
  });
});
