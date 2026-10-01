// Light sources the client draws a glow around. House windows glow at night while someone is in;
// they give no Light (ADR-0003), so nothing here changes what Gloamlings can do.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { tileCenter } from '../src/grid';
import { lightSources } from '../src/lights';
import { createInitialState, type MapDef } from '../src/map';
import { villageStock } from '../src/standingOrders';
import type { GameState } from '../src/state';
import { content, run } from './helpers';

/**
 * A Hut at (2,0) (door (2,1)), a woodcutter's hut at (6,0) and a Carrier at (4,3) who lives in
 * the Hut (set by hand; the Homes rule would on the first tick). IDs: Hut 1, woodcutter's hut 2,
 * Carrier 3.
 */
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 6 }, () => '..........'),
  buildings: [
    { type: 'hut', x: 2, y: 0 },
    { type: 'woodcutters_hut', x: 6, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 4, y: 3 }],
};

const HUT = 1;
const CARRIER = 3;
const WINTER_DAY = 16;

/** The camp at `tick`, with the Carrier standing at its Home's door when `home`. */
function campAt(tick: number, home: boolean): GameState {
  const s = createInitialState(1, camp, content);
  s.tick = tick;
  const carrier = s.components.villager[CARRIER];
  if (carrier) carrier.home = HUT;
  if (home) s.components.position[CARRIER] = tileCenter({ x: 2, y: 1 });
  return s;
}

describe('light sources', () => {
  it('are none by day', () => {
    expect(lightSources(campAt(duskTick(1, content) - 1, true), content)).toEqual([]);
  });

  it("include a House's windows at night while a resident is at Home", () => {
    expect(lightSources(campAt(duskTick(1, content), true), content)).toEqual([
      { id: HUT, kind: 'window' },
    ]);
  });

  it('leave a House dark while nobody is in', () => {
    expect(lightSources(campAt(duskTick(1, content), false), content)).toEqual([]);
  });

  it('leave a cold House dark', () => {
    const s = campAt(duskTick(WINTER_DAY, content), true);
    const hut = s.components.building[HUT];
    if (hut) hut.cold = true;
    expect(lightSources(s, content)).toEqual([]);
  });
});

/**
 * A torch at (2,2) holding `torch` firewood (ID 1) and a brazier at (8,2) holding `brazier`
 * (ID 2), on open Meadow with nobody to refill them.
 */
function lightsAt(tick: number, torch: number, brazier: number): GameState {
  const s = createInitialState(
    1,
    {
      name: 'lights',
      rows: Array.from({ length: 6 }, () => '............'),
      buildings: [
        { type: 'torch', x: 2, y: 2, stock: [{ resource: 'firewood', amount: torch }] },
        { type: 'brazier', x: 8, y: 2, stock: [{ resource: 'firewood', amount: brazier }] },
      ],
      villagers: [],
    },
    content,
  );
  s.tick = tick;
  return s;
}

const TORCH = 1;
const BRAZIER = 2;

function firewoodIn(s: GameState, id: number): number {
  return s.components.building[id]?.stock.firewood ?? 0;
}

describe('torches and braziers', () => {
  it('burn their night of firewood at Dusk and are lit until Dawn', () => {
    const s = run(lightsAt(duskTick(1, content), 3, 6), 1);
    expect([firewoodIn(s, TORCH), firewoodIn(s, BRAZIER)]).toEqual([2, 4]);
    expect(lightSources(s, content)).toEqual([
      { id: TORCH, kind: 'light', radiusTiles: 2 },
      { id: BRAZIER, kind: 'light', radiusTiles: 4 },
    ]);
    const dawn = run(s, dawnTick(2, content) - duskTick(1, content));
    expect([firewoodIn(dawn, TORCH), firewoodIn(dawn, BRAZIER)]).toEqual([2, 4]);
    expect(dawn.components.building[TORCH]?.lit).toBe(false);
  });

  it('burn nothing by day', () => {
    const s = run(
      lightsAt(dawnTick(2, content), 3, 6),
      duskTick(2, content) - dawnTick(2, content),
    );
    expect([firewoodIn(s, TORCH), firewoodIn(s, BRAZIER)]).toEqual([3, 6]);
  });

  it('burn every season, winter too', () => {
    const s = run(lightsAt(duskTick(WINTER_DAY, content), 1, 2), 1);
    expect([firewoodIn(s, TORCH), firewoodIn(s, BRAZIER)]).toEqual([0, 0]);
    expect(lightSources(s, content).map((l) => l.id)).toEqual([TORCH, BRAZIER]);
  });

  it('stay dark all night without a night of firewood, even when fuel comes later', () => {
    let s = run(lightsAt(duskTick(1, content), 0, 1), 1);
    expect([firewoodIn(s, TORCH), firewoodIn(s, BRAZIER)]).toEqual([0, 1]);
    expect(lightSources(s, content)).toEqual([]);
    const brazier = s.components.building[BRAZIER];
    if (brazier) brazier.stock.firewood = 6;
    s = run(s, 100);
    expect(lightSources(s, content)).toEqual([]);
  });
});

describe('fuelling lights', () => {
  const AUTUMN_DAY = 11;
  /**
   * A Hut at (2,0) (ID 1), a torch at (6,0) (ID 2) and a chopping block at (9,0) (ID 3, holding
   * `split` firewood, its woodsplitter ID 4 with no logs to split), a 1×1 stockpile at (4,4)
   * holding `piled` firewood and a Carrier at (4,5), a morning into `day`.
   */
  function yardAt(day: number, piled: number, split = 0): GameState {
    const s = createInitialState(
      1,
      {
        name: 'yard',
        rows: Array.from({ length: 8 }, () => '............'),
        buildings: [
          { type: 'hut', x: 2, y: 0 },
          { type: 'torch', x: 6, y: 0 },
          { type: 'chopping_block', x: 9, y: 0, stock: [{ resource: 'firewood', amount: split }] },
        ],
        stockpiles: [{ x: 4, y: 4, w: 1, h: 1, goods: [{ resource: 'firewood', amount: piled }] }],
        villagers: [{ job: 'carrier', x: 4, y: 5 }],
      },
      content,
    );
    s.tick = dawnTick(day, content) + 1;
    return s;
  }
  const HOUSE = 1;
  const LIGHT = 2;
  const BLOCK = 3;
  const PILE = 5;

  it('come after Houses', () => {
    const s = run(yardAt(AUTUMN_DAY, 2), 600);
    expect([firewoodIn(s, HOUSE), firewoodIn(s, LIGHT)]).toEqual([2, 0]);
  });

  it('are filled in every season, from Stockpiles', () => {
    const s = run(yardAt(1, 4), 800);
    expect([firewoodIn(s, HOUSE), firewoodIn(s, LIGHT)]).toEqual([0, 3]);
  });

  it('come before Stockpiles', () => {
    const s = run(yardAt(1, 0, 3), 800);
    expect(firewoodIn(s, LIGHT)).toBe(3);
    expect(firewoodIn(s, BLOCK)).toBe(0);
    expect(s.components.stockpile[PILE]?.goods).toEqual({});
  });

  it("count toward the chopping block's firewood target", () => {
    const s = yardAt(1, 0);
    const light = s.components.building[LIGHT];
    if (light) light.stock.firewood = 3;
    expect(villageStock(s, content, 'firewood')).toBe(3);
  });
});
