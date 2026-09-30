// Drains and Pass roads (spec, World and map: Terrain): groundwork laid tile by tile like a Road
// and built from ordinary construction sites. A finished Drain turns Swamp into Meadow; a finished
// Pass road opens its tile of Pass snow to everyone. Before the road, the Hero alone wades the snow.
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { noTiles, setTile } from '../src/fog';
import { tileIndex } from '../src/grid';
import { canLayGroundwork } from '../src/groundwork';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { mapChanged } from '../src/mapCache';
import { canLayPath } from '../src/roads';
import type { GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { canPlaceStockpile } from '../src/stockpiles';
import { walkTo } from '../src/systems/movement';
import { content, run, runUntil } from './helpers';

/**
 * A Carrier at (1,1) beside a Stockpile of `logs` logs down column 0, and a Granary of fish at
 * (2,0) so it doesn't starve, on the Meadow left of `rows`.
 */
function yard(rows: string[], logs = 20, map: Partial<MapDef> = {}): GameState {
  return createInitialState(
    1,
    {
      name: 'yard',
      rows,
      buildings: [{ type: 'granary', x: 2, y: 0, stock: [{ resource: 'fish', amount: 60 }] }],
      villagers: [{ job: 'carrier', x: 1, y: 1 }],
      stockpiles: [{ x: 0, y: 0, w: 1, h: 3, goods: [{ resource: 'logs', amount: logs }] }],
      ...map,
    },
    content,
  );
}

/** The yard's Carrier. */
function carrier(s: GameState): number {
  return Number(Object.keys(s.components.villager)[0]);
}

function terrainAt(s: GameState, t: Tile): string | undefined {
  return s.map.terrain[tileIndex(s.map, t.x, t.y)];
}

function logsLeft(s: GameState): number {
  const pile = Object.values(s.components.stockpile)[0];
  return Object.values(pile?.goods ?? {}).reduce(
    (sum, g) => sum + (g.resource === 'logs' ? g.amount : 0),
    0,
  );
}

const SWAMP = ['.....,,,,...', '.....,,,,...', '.....,,,,...'];

describe('Drains', () => {
  it('turn Swamp into buildable Meadow once built, a tile per site', () => {
    const s0 = run(yard(SWAMP), 1, {
      0: [{ type: 'layGroundwork', building: 'drain', from: { x: 5, y: 1 }, to: { x: 6, y: 1 } }],
    });
    expect(idsOf(s0.components.site).map((id) => s0.components.site[id]?.type)).toEqual([
      'drain',
      'drain',
    ]);
    expect(canPlaceStockpile(s0, content, 5, 1, 2, 1)).toBe(false);

    const s = runUntil(s0, (st) => idsOf(st.components.site).length === 0, 3000);
    expect(idsOf(s.components.site)).toEqual([]);
    expect(terrainAt(s, { x: 5, y: 1 })).toBe('meadow');
    expect(terrainAt(s, { x: 6, y: 1 })).toBe('meadow');
    expect(terrainAt(s, { x: 7, y: 1 })).toBe('swamp');
    expect(terrainAt(s, { x: 5, y: 0 })).toBe('swamp');
    // Nothing is left standing on the tile: it's plain Meadow now.
    expect(Object.values(s.components.building).map((b) => b.type)).toEqual(['granary']);
    expect(logsLeft(s)).toBe(16);
    expect(canPlaceStockpile(s, content, 5, 1, 2, 1)).toBe(true);
    expect(canLayPath(s, content, { x: 4, y: 1 }, { x: 6, y: 1 })).toBe(true);
    expect(canLayPath(s, content, { x: 4, y: 1 }, { x: 7, y: 1 })).toBe(false);
  });
});

/** A Pass of snow through a Mountain rim, columns 5–8 of row 1, Meadow either side. */
const PASS = ['.....^^^^...', '.....****...', '.....^^^^...'];

/** Tiles of row 1 holding the Pass road, by column. */
function passRoad(s: GameState): number[] {
  const columns: number[] = [];
  for (let x = 0; x < s.map.width; x++) {
    if (s.map.roads[tileIndex(s.map, x, 1)] === 'pass_road') columns.push(x);
  }
  return columns;
}

describe('laying groundwork', () => {
  it('goes only on Revealed tiles', () => {
    const s = yard(SWAMP);
    s.fog = true;
    s.map.revealed = noTiles(s.map);
    for (let x = 0; x <= 5; x++) setTile(s.map.revealed, tileIndex(s.map, x, 1));
    expect(canLayGroundwork(s, content, 'drain', { x: 5, y: 1 }, { x: 5, y: 1 })).toBe(true);
    expect(canLayGroundwork(s, content, 'drain', { x: 5, y: 1 }, { x: 6, y: 1 })).toBe(false);
  });

  it('carries on over sites already laid, and not onto trees or other terrain', () => {
    const rows = ['.....,,,,...', '.....,T,,...', '.....,,,,...'];
    const s = run(yard(rows), 2, {
      0: [{ type: 'layGroundwork', building: 'drain', from: { x: 5, y: 0 }, to: { x: 6, y: 0 } }],
      1: [{ type: 'layGroundwork', building: 'drain', from: { x: 5, y: 0 }, to: { x: 8, y: 0 } }],
    });
    const sites = idsOf(s.components.site).map((id) => s.components.tile[id]?.x);
    expect(sites).toEqual([5, 6, 7, 8]);
    expect(canLayGroundwork(s, content, 'drain', { x: 5, y: 1 }, { x: 7, y: 1 })).toBe(false);
    expect(canLayGroundwork(s, content, 'drain', { x: 4, y: 2 }, { x: 5, y: 2 })).toBe(false);
    expect(canLayGroundwork(s, content, 'drain', { x: 5, y: 0 }, { x: 8, y: 0 })).toBe(false);
  });
});

describe('Pass roads', () => {
  it('open the Pass to villagers tile by tile, from the end they can reach', () => {
    const s0 = run(yard(PASS, 24), 1, {
      0: [
        { type: 'layGroundwork', building: 'pass_road', from: { x: 5, y: 1 }, to: { x: 8, y: 1 } },
      ],
    });
    expect(idsOf(s0.components.site)).toHaveLength(4);
    expect(walkTo(s0, content, carrier(s0), [{ x: 10, y: 1 }])).toBe(false);

    // Each site is supplied from the tile finished before it, so they finish in walking order.
    let s = s0;
    const finished: number[][] = [];
    for (let n = 1; n <= 4; n++) {
      s = runUntil(s, (st) => passRoad(st).length === n, 20_000);
      finished.push(passRoad(s));
      if (n < 4) {
        const probe: GameState = JSON.parse(JSON.stringify(s));
        expect(walkTo(probe, content, carrier(probe), [{ x: 5 + n, y: 1 }])).toBe(false);
      }
    }
    expect(finished).toEqual([[5], [5, 6], [5, 6, 7], [5, 6, 7, 8]]);
    expect(idsOf(s.components.site)).toEqual([]);
    expect(logsLeft(s)).toBe(0);
    // Still Pass snow underneath, but open all year.
    expect(terrainAt(s, { x: 6, y: 1 })).toBe('pass_snow');
    expect(walkTo(s, content, carrier(s), [{ x: 10, y: 1 }])).toBe(true);
  });

  it('let Gloamlings through the Pass once every tile of it is built', () => {
    // A Den east of the Pass; its Gloamling comes out at the first Dusk tick.
    const dusk = createInitialState(
      1,
      {
        name: 'pass',
        rows: PASS.map((r, y) => (y === 1 ? `${r.slice(0, 11)}D` : r)),
        buildings: [],
        villagers: [],
      },
      content,
    );
    dusk.tick = duskTick(1, content);
    const s = step(dusk, [], content);
    const gloamling = Number(Object.keys(s.components.gloamling)[0]);
    expect(s.components.gloamling[gloamling]).toBeDefined();
    delete s.components.path[gloamling];
    expect(walkTo(s, content, gloamling, [{ x: 1, y: 1 }])).toBe(false);

    for (const x of [5, 6, 7]) s.map.roads[tileIndex(s.map, x, 1)] = 'pass_road';
    mapChanged(s);
    expect(walkTo(s, content, gloamling, [{ x: 1, y: 1 }])).toBe(false);

    s.map.roads[tileIndex(s.map, 8, 1)] = 'pass_road';
    mapChanged(s);
    expect(walkTo(s, content, gloamling, [{ x: 1, y: 1 }])).toBe(true);
  });

  it('go only on Pass snow, and a Dirt path never does', () => {
    const s = yard(PASS);
    /** Which of a Pass road, a Drain and a Dirt path can be laid along the L. */
    const along = (from: Tile, to: Tile) =>
      [
        canLayGroundwork(s, content, 'pass_road', from, to) && 'road',
        canLayGroundwork(s, content, 'drain', from, to) && 'drain',
        canLayPath(s, content, from, to) && 'path',
      ].filter(Boolean);
    expect(along({ x: 5, y: 1 }, { x: 8, y: 1 })).toEqual(['road']);
    expect(along({ x: 6, y: 1 }, { x: 6, y: 1 })).toEqual(['road']);
    expect(along({ x: 4, y: 1 }, { x: 8, y: 1 })).toEqual([]);
    expect(along({ x: 1, y: 2 }, { x: 3, y: 2 })).toEqual(['path']);
    const t = run(s, 1, { 0: [{ type: 'layPath', from: { x: 5, y: 1 }, to: { x: 8, y: 1 } }] });
    expect(passRoad(t)).toEqual([]);
    expect(Object.keys(t.map.roads)).toEqual([]);
  });

  it('stay when Remove path is dragged over them', () => {
    const s = yard(PASS);
    for (const x of [5, 6]) s.map.roads[tileIndex(s.map, x, 1)] = 'pass_road';
    mapChanged(s);
    const t = run(s, 2, {
      0: [{ type: 'layPath', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } }],
      1: [{ type: 'removePath', from: { x: 1, y: 1 }, to: { x: 8, y: 1 } }],
    });
    expect(passRoad(t)).toEqual([5, 6]);
    expect(Object.values(t.map.roads)).toEqual(['pass_road', 'pass_road']);
  });
});

describe('the Hero in the snow', () => {
  /** Ticks for the Hero, ordered from (1,1) to (10,1) by a right-click, to get there. */
  function heroCrossing(rows: string[]): { ticks: number; path: number[] } {
    const s0 = createInitialState(
      1,
      { name: 'wade', rows, buildings: [], villagers: [], hero: { x: 1, y: 1 } },
      content,
    );
    const order = heroOrderAt(s0, content, { x: 10, y: 1 });
    expect(order).toEqual({ order: 'move', x: 10, y: 1 });
    let s = step(s0, order ? [{ type: 'orderHero', ...order }] : [], content);
    const hero = Number(Object.keys(s.components.hero)[0]);
    const path = [...(s.components.path[hero]?.tiles ?? [])];
    let ticks = 1; // it sets off on the tick it's ordered
    while (s.components.path[hero] && ticks < 1000) {
      s = step(s, [], content);
      ticks += 1;
    }
    expect(s.components.position[hero]).toEqual({ x: 10_500, y: 1500 });
    return { ticks, path: path.map((i) => i % s.map.width) };
  }

  it('wades Pass snow at 30% where a villager or a Gloamling can’t set foot', () => {
    const meadow = heroCrossing(['............', '............', '............']);
    const pass = heroCrossing(PASS);
    // Straight along row 1, through all four snow tiles.
    expect(pass.path).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // 9 tiles of 1000 units at 100 a tick take 90 ticks. Through the Pass, 5 Meadow tiles take
    // 50 and the 4000 units of snow at 30 a tick 133⅓, so 184 ticks in all.
    expect(meadow.ticks).toBe(90);
    expect(pass.ticks).toBe(184);

    const s = yard(PASS, 20, { hero: { x: 1, y: 2 } });
    expect(walkTo(s, content, carrier(s), [{ x: 6, y: 1 }])).toBe(false);
    // A right-click on the snow walks the Hero into it; on the Mountain, nothing.
    expect(heroOrderAt(s, content, { x: 6, y: 1 })).toEqual({ order: 'move', x: 6, y: 1 });
    expect(heroOrderAt(s, content, { x: 6, y: 0 })).toBeNull();
  });

  it('walks a finished Pass road at the road’s speed, not the snow’s', () => {
    const s0 = createInitialState(
      1,
      { name: 'wade', rows: PASS, buildings: [], villagers: [], hero: { x: 1, y: 1 } },
      content,
    );
    for (const x of [5, 6, 7, 8]) s0.map.roads[tileIndex(s0.map, x, 1)] = 'pass_road';
    mapChanged(s0);
    const hero = Number(Object.keys(s0.components.hero)[0]);
    const s = step(s0, [{ type: 'orderHero', order: 'move', x: 10, y: 1 }], content);
    let t = s;
    let ticks = 1;
    while (t.components.path[hero] && ticks < 1000) {
      t = step(t, [], content);
      ticks += 1;
    }
    expect(ticks).toBe(90);
  });
});
