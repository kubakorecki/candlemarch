// Palisades and Gates: wall segments laid by dragging like a Road and built from sites. A
// palisade blocks villagers and Gloamlings alike; a Gate lets villagers and the Hero through, but
// not Gloamlings.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { canPlaceBuilding, tileIndex } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath } from '../src/roads';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { step } from '../src/step';
import { amountOnTile, canPlaceStockpile } from '../src/stockpiles';
import { walkTo } from '../src/systems/movement';
import { canLayWall } from '../src/walls';
import { content, run, runUntil } from './helpers';

/** `width`×`height` open grass, with `T` trees on `trees`. */
function grass(width: number, height: number, trees: Tile[] = []): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      trees.some((t) => t.x === x && t.y === y) ? 'T' : '.',
    ).join(''),
  );
}

function yard(map: Partial<MapDef> = {}): GameState {
  return createInitialState(
    1,
    { name: 'yard', rows: grass(12, 7), buildings: [], villagers: [], ...map },
    content,
  );
}

/** Wall sites and walls by tile, `P`/`G` built and `p`/`g` sites, in ID order. */
function walls(s: GameState): string[] {
  const { site, building, tile } = s.components;
  return idsOf(tile)
    .map((id) => {
      const type = site[id]?.type ?? building[id]?.type;
      const t = tile[id];
      if (!t || (type !== 'palisade' && type !== 'gate')) return null;
      const letter = type === 'palisade' ? 'p' : 'g';
      return `${building[id] ? letter.toUpperCase() : letter}(${t.x},${t.y})`;
    })
    .filter((w) => w !== null);
}

describe('laying palisades', () => {
  it('lays a site on each tile of the L, in walking order', () => {
    const s = run(yard(), 1, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 2, y: 1 }, to: { x: 4, y: 3 } }],
    });
    expect(walls(s)).toEqual(['p(2,1)', 'p(3,1)', 'p(4,1)', 'p(4,2)', 'p(4,3)']);
  });

  it('lays nothing if any tile of the L is taken', () => {
    const s = run(yard({ rows: grass(12, 7, [{ x: 3, y: 1 }]) }), 1, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 2, y: 1 }, to: { x: 4, y: 3 } }],
    });
    expect(walls(s)).toEqual([]);
  });

  it("lays nothing inside a Den's dark ring", () => {
    const rows = grass(12, 7).map((r, y) => (y === 3 ? `${r.slice(0, 11)}D` : r));
    const s = run(yard({ rows }), 1, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 1, y: 3 }, to: { x: 6, y: 3 } }],
    });
    expect(walls(s)).toEqual([]);
  });

  it('carries on over segments already laid, so a line can be dragged on from its end', () => {
    const s = run(yard(), 2, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }],
      1: [{ type: 'layWall', building: 'gate', from: { x: 2, y: 1 }, to: { x: 5, y: 1 } }],
    });
    expect(walls(s)).toEqual(['p(2,1)', 'p(3,1)', 'g(4,1)', 'g(5,1)']);
  });

  it('keeps other buildings, stockpiles and Roads off wall segments and their sites', () => {
    const s = run(yard(), 1, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 2, y: 1 }, to: { x: 2, y: 1 } }],
    });
    expect(canPlaceBuilding(s, content, 'torch', 2, 1)).toBe(false);
    expect(canPlaceStockpile(s, content, 2, 1, 1, 1)).toBe(false);
    expect(canLayPath(s, content, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
  });

  it('lets a Gate stand on a Road, and a Road run through a Gate', () => {
    const rows = grass(12, 7).map((r, y) => (y === 1 ? '='.repeat(12) : r));
    const s = run(yard({ rows }), 2, {
      0: [{ type: 'layWall', building: 'gate', from: { x: 2, y: 1 }, to: { x: 2, y: 1 } }],
      1: [{ type: 'layWall', building: 'gate', from: { x: 2, y: 3 }, to: { x: 2, y: 3 } }],
    });
    expect(walls(s)).toEqual(['g(2,1)', 'g(2,3)']);
    expect(canLayPath(s, content, { x: 1, y: 3 }, { x: 3, y: 3 })).toBe(true);
    expect(canLayWall(s, content, 'palisade', { x: 5, y: 1 }, { x: 5, y: 1 })).toBe(false);
  });
});

/** Logs left on the stockpile at (0,6). */
function logsOnPile(s: GameState): number {
  const [pile] = idsOf(s.components.stockpile);
  const p = pile === undefined ? undefined : s.components.stockpile[pile];
  return p ? amountOnTile(p, tileIndex(s.map, 0, 6), 'logs') : 0;
}

describe('building palisades', () => {
  /** A Carrier at (1,5) next to a stockpile of 6 logs at (0,6); a palisade laid at (6,3). */
  function yardWithLogs(type: 'palisade' | 'gate'): GameState {
    return run(
      yard({
        stockpiles: [{ x: 0, y: 6, w: 1, h: 1, goods: [{ resource: 'logs', amount: 6 }] }],
        villagers: [{ job: 'carrier', x: 1, y: 5 }],
      }),
      1,
      { 0: [{ type: 'layWall', building: type, from: { x: 6, y: 3 }, to: { x: 6, y: 3 } }] },
    );
  }

  it('Carriers bring the logs to the site, which then builds into a wall with full HP', () => {
    const s0 = yardWithLogs('palisade');
    const [id] = idsOf(s0.components.site);
    if (id === undefined) throw new Error('no site');
    const s = runUntil(s0, (st) => st.components.building[id] !== undefined, 2000);
    expect(s.components.building[id]).toMatchObject({ type: 'palisade', hp: 100 });
    expect(logsOnPile(s)).toBe(4);
  });

  it('a Gate costs 4 logs and has full HP once built', () => {
    const s0 = yardWithLogs('gate');
    const [id] = idsOf(s0.components.site);
    if (id === undefined) throw new Error('no site');
    const s = runUntil(s0, (st) => st.components.building[id] !== undefined, 2000);
    expect(s.components.building[id]).toMatchObject({ type: 'gate', hp: 100 });
    expect(logsOnPile(s)).toBe(2);
  });

  it('builds only by day', () => {
    const s0 = yardWithLogs('palisade');
    const [id] = idsOf(s0.components.site);
    const site = id === undefined ? undefined : s0.components.site[id];
    if (id === undefined || !site) throw new Error('no site');
    site.delivered = { logs: 2 };
    s0.tick = duskTick(1, content);
    const night = run(s0, 100);
    expect(night.components.site[id]?.buildProgress).toBe(0);
    night.tick = dawnTick(2, content);
    const day = run(night, 40);
    expect(day.components.building[id]?.hp).toBe(100);
  });
});

/** Built wall segments down column `x`, rows 0 to `height` − 1 but `gaps`; Gates on `gates` rows. */
function wallDown(
  x: number,
  height: number,
  { gates = [], gaps = [] }: { gates?: number[]; gaps?: number[] } = {},
): MapDef['buildings'] {
  return Array.from({ length: height }, (_, y) => y)
    .filter((y) => !gaps.includes(y))
    .map((y) => ({ type: gates.includes(y) ? 'gate' : 'palisade', x, y }));
}

describe('what walls block', () => {
  /** A wall down x=6 (Gates on `gates` rows); a Carrier (ID after the wall) at (2,3), the Hero next. */
  function walled(gates: number[]): { s: GameState; carrier: EntityId; hero: EntityId } {
    const s = yard({
      buildings: wallDown(6, 7, { gates }),
      villagers: [{ job: 'carrier', x: 2, y: 3 }],
      hero: { x: 2, y: 4 },
    });
    const [carrier] = idsOf(s.components.villager);
    const [hero] = idsOf(s.components.hero);
    if (carrier === undefined || hero === undefined) throw new Error('no walkers');
    return { s, carrier, hero };
  }

  it("villagers and the Hero can't walk through a palisade", () => {
    const { s, carrier, hero } = walled([]);
    expect(walkTo(s, content, carrier, [{ x: 10, y: 3 }])).toBe(false);
    expect(walkTo(s, content, hero, [{ x: 10, y: 3 }])).toBe(false);
  });

  it('villagers and the Hero walk through a Gate', () => {
    const { s, carrier, hero } = walled([5]);
    expect(walkTo(s, content, carrier, [{ x: 10, y: 3 }])).toBe(true);
    expect(walkTo(s, content, hero, [{ x: 10, y: 3 }])).toBe(true);
    const gate = tileIndex(s.map, 6, 5);
    expect(s.components.path[carrier]?.tiles).toContain(gate);
    expect(s.components.path[hero]?.tiles).toContain(gate);
  });

  it('saves made before walls load with HP on walls and none on other buildings', () => {
    const s = yard({
      buildings: [...(wallDown(6, 2, { gates: [1] }) ?? []), { type: 'hut', x: 1, y: 1 }],
    });
    const data = JSON.parse(serialize(s));
    for (const b of Object.values(data.components.building) as Record<string, unknown>[]) {
      delete b.hp;
    }
    const loaded = deserialize(JSON.stringify(data), content);
    expect(Object.values(loaded.components.building).map((b) => [b.type, b.hp])).toEqual([
      ['palisade', 100],
      ['gate', 100],
      ['hut', null],
    ]);
  });

  it("a wall's site blocks nobody", () => {
    const s0 = yard({ villagers: [{ job: 'carrier', x: 2, y: 3 }] });
    const s = run(s0, 1, {
      0: [{ type: 'layWall', building: 'palisade', from: { x: 6, y: 0 }, to: { x: 6, y: 6 } }],
    });
    const [carrier] = idsOf(s.components.villager);
    if (carrier === undefined) throw new Error('no carrier');
    expect(walkTo(s, content, carrier, [{ x: 10, y: 3 }])).toBe(true);
  });
});

describe('Gloamlings and walls', () => {
  const WIDTH = 30;
  const HEIGHT = 9;

  /**
   * A field at Dusk: a Den at (20,4) (ID 1; dark ring x 14–26) sends out one Gloamling on the
   * first tick; `buildings` next, then a Carrier at (9,4), in its sight, asleep in the open.
   */
  function fieldAtDusk(buildings: MapDef['buildings']): GameState {
    const rows = Array.from({ length: HEIGHT }, (_, y) =>
      Array.from({ length: WIDTH }, (_, x) => (x === 20 && y === 4 ? 'D' : '.')).join(''),
    );
    const s = createInitialState(
      1,
      { name: 'field', rows, buildings, villagers: [{ job: 'carrier', x: 9, y: 4 }] },
      content,
    );
    s.tick = duskTick(1, content);
    return s;
  }

  /** Runs `ticks` ticks, collecting every tile the Gloamling stands on or walks through. */
  function watch(s0: GameState, ticks: number): { s: GameState; tiles: Set<string> } {
    let s = s0;
    const tiles = new Set<string>();
    for (let i = 0; i < ticks; i++) {
      s = step(s, [], content);
      for (const g of idsOf(s.components.gloamling)) {
        const at = s.components.position[g];
        if (at) tiles.add(`${Math.floor(at.x / 1000)},${Math.floor(at.y / 1000)}`);
      }
    }
    return { s, tiles };
  }

  it('path around a palisade to their target', () => {
    const s0 = fieldAtDusk(wallDown(11, HEIGHT, { gaps: [8] }));
    const { s, tiles } = watch(s0, 600);
    expect(s.deaths.map((d) => d.cause)).toEqual(['gloamling']);
    expect([...tiles].filter((t) => t.startsWith('11,'))).toEqual(['11,8']);
  });

  it('stop when palisades and Gates shut their target in', () => {
    const s0 = fieldAtDusk(wallDown(11, HEIGHT, { gates: [4] }));
    const [carrier] = idsOf(s0.components.villager);
    const { s, tiles } = watch(s0, 600);
    const [g] = idsOf(s.components.gloamling);
    expect(s.components.gloamling[g ?? -1]?.target).toBeNull();
    expect(s.components.villager[carrier ?? -1]?.fighting).toBe(false);
    expect([...tiles].some((t) => Number(t.split(',')[0]) <= 11)).toBe(false);
  });
});
