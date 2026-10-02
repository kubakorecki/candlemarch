// Workplace yards: a 1×1 tile of the building beside its door where its output piles up, holding
// `logistics.yardCapacity` in total across all its outputs.
import { describe, expect, it } from 'vitest';
import { workplaceStatus } from '../src/bottlenecks';
import { idsOf } from '../src/entities';
import { buildingLayout, canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState, Rotation } from '../src/state';
import { content, run } from './helpers';

const CAPACITY = content.logistics.yardCapacity;

const open: MapDef = {
  name: 'open',
  rows: ['..........', '..........', '..........', '..........', '..........', '..........'],
  buildings: [],
  villagers: [],
};

function placed(s: GameState, type: string): number {
  const id = idsOf(s.components.building).find((b) => s.components.building[b]?.type === type);
  if (id === undefined) throw new Error(`no ${type}`);
  return id;
}

describe('a Workplace yard', () => {
  it('is the tile beside the door, turning with the building', () => {
    const def = content.buildings.woodcutters_hut;
    const at = { x: 4, y: 4 };
    const yards = ([0, 1, 2, 3] as Rotation[]).map((r) => buildingLayout(def, at, r).yard);
    expect(yards).toEqual([
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 3, y: 4 },
      { x: 4, y: 3 },
    ]);
    // Part of the footprint.
    expect(buildingLayout(def, at, 0).tiles).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
  });

  it('only Workplaces with an output get one: not a Granary or a House', () => {
    expect(buildingLayout(content.buildings.granary, { x: 2, y: 2 }).yard).toBeNull();
    expect(buildingLayout(content.buildings.hut, { x: 2, y: 2 }).yard).toBeNull();
    expect(buildingLayout(content.buildings.foresters_lodge, { x: 2, y: 2 }).yard).toBeNull();
  });

  it('is refused to other placements, on every turn', () => {
    for (const rotation of [0, 1, 2, 3] as Rotation[]) {
      const s = createInitialState(1, open, content);
      const hut = { x: 4, y: 2, rotation };
      const next = run(s, 1, {
        0: [{ type: 'placeBuilding', building: 'woodcutters_hut', ...hut }],
      });
      const yard = buildingLayout(content.buildings.woodcutters_hut, hut, rotation).yard;
      if (!yard) throw new Error('no yard');
      expect(canPlaceBuilding(next, content, 'torch', yard.x, yard.y)).toBe(false);
      expect(canPlaceBuilding(s, content, 'torch', yard.x, yard.y)).toBe(true);
    }
  });

  it('keeps a building from standing where its yard would go', () => {
    const s = createInitialState(
      1,
      { ...open, buildings: [{ type: 'torch', x: 5, y: 2 }] },
      content,
    );
    expect(canPlaceBuilding(s, content, 'woodcutters_hut', 4, 2)).toBe(false);
    expect(canPlaceBuilding(s, content, 'woodcutters_hut', 4, 2, 1)).toBe(true);
  });
});

/**
 * A forager's hut at (1,1) (door (1,2), yard (2,1)) and a berry bush at (5,2) shaded by a tree at
 * (4,3).
 */
const grove: MapDef = {
  name: 'grove',
  rows: ['..........', '..........', '.....b....', '....T.....', '..........'],
  buildings: [{ type: 'foragers_hut', x: 1, y: 1 }],
  villagers: [],
};

function bush(s: GameState): number {
  const id = idsOf(s.components.mapObject).find(
    (o) => s.components.mapObject[o]?.type === 'berry_bush',
  );
  return s.components.mapObject[id ?? -1]?.amount ?? -1;
}

describe('a gatherer', () => {
  it('stops when the shared yard has no room for a whole basket', () => {
    // 8 of 10 held, berries and mushrooms together: no room for a basket of 3.
    const s0 = createInitialState(
      1,
      {
        ...grove,
        buildings: [
          {
            type: 'foragers_hut',
            x: 1,
            y: 1,
            stock: [
              { resource: 'berries', amount: 4 },
              { resource: 'mushrooms', amount: 4 },
            ],
          },
        ],
      },
      content,
    );
    const s = run(s0, 600);
    expect(bush(s)).toBe(bush(s0));
    const hut = placed(s, 'foragers_hut');
    expect(workplaceStatus(s, content, hut)).toEqual({
      kind: 'outputFull',
      resources: ['berries', 'mushrooms'],
    });
  });

  it('fills the yard to its capacity while a whole basket fits', () => {
    const s0 = createInitialState(
      1,
      {
        ...grove,
        buildings: [
          {
            type: 'foragers_hut',
            x: 1,
            y: 1,
            stock: [
              { resource: 'berries', amount: 4 },
              { resource: 'mushrooms', amount: 3 },
            ],
          },
        ],
      },
      content,
    );
    const s = run(s0, 1200);
    const stock = s.components.building[placed(s, 'foragers_hut')]?.stock ?? {};
    expect((stock.berries ?? 0) + (stock.mushrooms ?? 0)).toBe(CAPACITY);
    expect(bush(s)).toBe(bush(s0) - 3);
  });

  it("waits while a hunter's whole catch doesn't fit beside the meat and hides there", () => {
    // 6 of 10 held: room for 4, a catch with a tool is 4 meat and 1 hide.
    const s0 = createInitialState(
      1,
      {
        name: 'wood',
        rows: ['..........', '.TTTT.....', '.TTTT.....', '..........', '..........'],
        buildings: [
          {
            type: 'hunters_lodge',
            x: 7,
            y: 2,
            stock: [
              { resource: 'meat', amount: 4 },
              { resource: 'hides', amount: 2 },
            ],
          },
        ],
        villagers: [],
        huntingGrounds: [{ name: 'Old Wood', x: 0, y: 0, w: 6, h: 4, maxGame: 20 }],
      },
      content,
    );
    const lodge = s0.components.building[9];
    if (lodge) lodge.tools = [0];
    const s = run(s0, 600);
    const hunter = idsOf(s.components.hunter)[0] ?? -1;
    expect(s.components.hunter[hunter]?.kind).toBe('idle');
    expect(s.components.position[hunter]).toEqual(s0.components.position[hunter]);
  });
});

describe('Carriers', () => {
  it('empty a full yard onto a Stockpile, picking up at the door', () => {
    const s0 = createInitialState(
      1,
      {
        ...open,
        buildings: [
          { type: 'woodcutters_hut', x: 1, y: 1, stock: [{ resource: 'logs', amount: CAPACITY }] },
        ],
        stockpiles: [{ x: 6, y: 3, w: 1, h: 1 }],
        villagers: [{ job: 'carrier', x: 4, y: 4 }],
      },
      content,
    );
    const s = run(s0, 2400);
    expect(s.components.building[placed(s, 'woodcutters_hut')]?.stock.logs ?? 0).toBe(0);
    const pile = idsOf(s.components.stockpile)[0] ?? -1;
    const goods = Object.values(s.components.stockpile[pile]?.goods ?? {});
    expect(goods).toEqual([{ resource: 'logs', amount: CAPACITY }]);
  });
});
