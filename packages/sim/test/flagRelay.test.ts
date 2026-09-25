import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { tileAt, tileIndex } from '../src/grid';
import { unstaffedSegments } from '../src/logistics/flagRelay';
import { type FlagRelayState, relayOf } from '../src/logistics/relayState';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState, StockpileComponent } from '../src/state';
import { content, run, runUntil } from './helpers';

// Woodcutter's hut at (0,0) with its door at (1,2). No trees, so its buffer only changes by hand.
const lane: MapDef = {
  name: 'lane',
  rows: Array(6).fill('................'),
  buildings: [{ type: 'woodcutters_hut', x: 0, y: 0 }],
  villagers: [],
};

/** A new flag-relay game on `map`. */
function relayGame(map: MapDef = lane): GameState {
  return createInitialState(1, map, content, 'flagRelay');
}

/** Tile index as "x,y". */
function xy(s: GameState, i: number): string {
  const { x, y } = tileAt(s.map, i);
  return `${x},${y}`;
}

/** Placed flags as "x,y". */
function flags(s: GameState): string[] {
  return (relayOf(s)?.flags ?? []).map((i) => xy(s, i));
}

/** Segments in ID order, as "x,y-x,y". */
function segments(s: GameState): string[] {
  const relay = relayOf(s);
  if (!relay) return [];
  return idsOf(relay.segments).map((id) => {
    const [a, b] = relay.segments[id]?.ends ?? [0, 0];
    return `${xy(s, a)}-${xy(s, b)}`;
  });
}

/** Carriers in ID order. */
function carrierIds(s: GameState): number[] {
  return idsOf(s.components.villager).filter((v) => s.components.villager[v]?.job === 'carrier');
}

/** The segment a carrier staffs, as "x,y-x,y", or null. */
function staffs(s: GameState, carrier: number): string | null {
  const relay = relayOf(s);
  const segment = relay?.carriers[carrier]?.segment;
  const ends = segment === undefined ? undefined : relay?.segments[segment]?.ends;
  return ends ? `${xy(s, ends[0])}-${xy(s, ends[1])}` : null;
}

const flagAt = (x: number, y: number): Command => ({ type: 'placeFlag', x, y });
// A road along row 2 from the woodcutter's hut door (1,2) to (13,2).
const road: Command = { type: 'layPath', from: { x: 1, y: 2 }, to: { x: 13, y: 2 } };

describe('placeFlag / removeFlag', () => {
  it('places flags on path tiles at least 2 tiles apart along the path', () => {
    const s = run(relayGame(), 2, {
      0: [road, flagAt(5, 2)],
      1: [
        flagAt(6, 2), // next to the flag at (5,2)
        flagAt(2, 2), // next to the door at (1,2), which is a flag
        flagAt(1, 2), // the door itself
        flagAt(3, 3), // not on a path
        flagAt(20, 2), // off the map
        flagAt(7, 2),
        flagAt(7, 2), // already there
      ],
    });
    expect(flags(s)).toEqual(['5,2', '7,2']);
  });

  it('counts distance along the path, not across it', () => {
    // Two paths side by side on rows 2 and 3, not joined: (5,2) and (5,3) aren't neighbours on a path.
    const s = run(relayGame(), 1, {
      0: [
        { type: 'layPath', from: { x: 4, y: 2 }, to: { x: 8, y: 2 } },
        { type: 'layPath', from: { x: 4, y: 4 }, to: { x: 8, y: 4 } },
        { type: 'layPath', from: { x: 9, y: 2 }, to: { x: 9, y: 4 } },
        flagAt(5, 2),
        flagAt(5, 4),
      ],
    });
    expect(flags(s)).toEqual(['5,2', '5,4']);
  });

  it('removes flags by command and with the path under them', () => {
    const s = run(relayGame(), 3, {
      0: [road, flagAt(5, 2), flagAt(9, 2)],
      1: [{ type: 'removeFlag', x: 5, y: 2 }],
      2: [{ type: 'removePath', from: { x: 9, y: 2 }, to: { x: 9, y: 2 } }],
    });
    expect(flags(s)).toEqual([]);
  });

  it('are ignored under job dispatch', () => {
    const s0 = createInitialState(1, lane, content);
    const withFlag = run(s0, 1, { 0: [road, flagAt(5, 2)] });
    expect(withFlag).toEqual(run(s0, 1, { 0: [road] }));
  });
});

// Two carriers standing south of the road.
const lane2: MapDef = {
  ...lane,
  villagers: [
    { job: 'carrier', x: 2, y: 5 },
    { job: 'carrier', x: 10, y: 5 },
  ],
};

describe('segments', () => {
  it('run between neighbouring flags, doors included', () => {
    const s = run(relayGame(), 1, {
      0: [
        road,
        flagAt(5, 2),
        flagAt(9, 2),
        flagAt(13, 2),
        // A branch south from (7,2) with a flag at its end: a junction without a flag.
        { type: 'layPath', from: { x: 7, y: 3 }, to: { x: 7, y: 5 } },
        flagAt(7, 5),
      ],
    });
    expect(segments(s)).toEqual(['1,2-5,2', '5,2-9,2', '5,2-7,5', '9,2-13,2', '9,2-7,5']);
    const relay = relayOf(s);
    expect(relay?.segments[3]?.tiles.map((i) => xy(s, i))).toEqual([
      '5,2',
      '6,2',
      '7,2',
      '7,3',
      '7,4',
      '7,5',
    ]);
  });

  it('are staffed by idle carriers, oldest segment first, who walk there and stay', () => {
    const s0 = relayGame(lane2);
    const [first, second] = carrierIds(s0) as [number, number];
    const s = run(s0, 300, { 0: [road, flagAt(5, 2), flagAt(9, 2), flagAt(13, 2)] });
    expect(staffs(s, first)).toBe('1,2-5,2');
    expect(staffs(s, second)).toBe('5,2-9,2');
    expect(
      unstaffedSegments(s).map((seg) => `${xy(s, seg.ends[0])}-${xy(s, seg.ends[1])}`),
    ).toEqual(['9,2-13,2']);
    // Each waits at the end of its segment that was nearer when it was staffed.
    expect(s.components.position[first]).toEqual({ x: 1500, y: 2500 });
    expect(s.components.position[second]).toEqual({ x: 9500, y: 2500 });
    expect(s.components.path[first]).toBeUndefined();
  });

  it('free their carriers when they go, and the oldest unstaffed segments take them', () => {
    const s0 = relayGame(lane2);
    const [first, second] = carrierIds(s0) as [number, number];
    const s = run(s0, 3, {
      0: [road, flagAt(5, 2), flagAt(9, 2), flagAt(13, 2)],
      // A fourth segment, newer than the unstaffed third.
      1: [{ type: 'layPath', from: { x: 13, y: 3 }, to: { x: 13, y: 4 } }, flagAt(13, 4)],
      // Both staffed segments end at (5,2); removing it joins them into a new, fifth segment.
      2: [{ type: 'removeFlag', x: 5, y: 2 }],
    });
    expect(segments(s)).toEqual(['9,2-13,2', '13,2-13,4', '1,2-9,2']);
    expect(staffs(s, first)).toBe('9,2-13,2');
    expect(staffs(s, second)).toBe('13,2-13,4');
  });
});

// Three carriers south of the road, one per segment once it's split by flags at (5,2) and (9,2).
const lane3: MapDef = {
  ...lane,
  villagers: [
    { job: 'carrier', x: 2, y: 4 },
    { job: 'carrier', x: 6, y: 4 },
    { job: 'carrier', x: 10, y: 4 },
  ],
};

/** `game` with `logs` in the starting woodcutter's hut buffer. */
function stocked(game: GameState, logs: number): GameState {
  const hut = idsOf(game.components.building)[0] as number;
  game.components.building[hut] = { type: 'woodcutters_hut', stock: { logs } };
  return game;
}

function hutStock(s: GameState): number {
  const hut = idsOf(s.components.building)[0] as number;
  return s.components.building[hut]?.stock.logs ?? 0;
}

// A hut site at (13,1), so its door (13,2) is on the road: a door flag.
const placeSite: Command = { type: 'placeBuilding', building: 'hut', x: 13, y: 1 };
const network: Command[] = [road, flagAt(5, 2), flagAt(9, 2), placeSite];

describe('relaying goods', () => {
  it('hands logs flag to flag, one carrier per segment, until the site is built', () => {
    let s = run(stocked(relayGame(lane3), 10), 1, { 0: network });
    const site = idsOf(s.components.site)[0] as number;
    const carried = new Set<number>();
    for (let i = 0; i < 3000 && !s.components.building[site]; i++) {
      s = run(s, 1);
      for (const id of carrierIds(s)) {
        if (s.components.villager[id]?.carrying) carried.add(id);
        // Once staffed, a carrier never leaves its segment's tiles.
        const relay = relayOf(s);
        const segment = relay?.segments[relay.carriers[id]?.segment ?? -1];
        const pos = s.components.position[id];
        if (segment && pos && relay?.carriers[id]?.task.kind !== 'toFlag') {
          const tile = tileIndex(s.map, Math.floor(pos.x / 1000), Math.floor(pos.y / 1000));
          expect(segment.tiles).toContain(tile);
        }
      }
    }
    expect(s.components.building[site]?.type).toBe('hut');
    expect(hutStock(s)).toBe(0);
    expect([...carried].sort()).toEqual(carrierIds(s));
  });
});

/** Logs anywhere: buffers, sites, stockpiles, carriers' hands, and on Flags (not counting those still on a stockpile). */
function logsInWorld(s: GameState): number {
  let total = 0;
  for (const b of Object.values(s.components.building)) total += b.stock.logs ?? 0;
  for (const site of Object.values(s.components.site)) total += site.delivered.logs ?? 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const g of Object.values(pile.goods)) total += g.amount;
  }
  for (const v of Object.values(s.components.villager)) total += v.carrying?.amount ?? 0;
  for (const goods of Object.values(relayOf(s)?.waiting ?? {})) {
    total += goods.filter((g) => g.onStockpile === undefined).length;
  }
  return total;
}

/** Adds a carrier standing on tile (x, y). */
function addCarrier(s: GameState, x: number, y: number): number {
  const id = s.nextId;
  s.nextId += 1;
  s.components.villager[id] = { job: 'carrier', workplace: null, carrying: null };
  s.components.position[id] = { x: x * 1000 + 500, y: y * 1000 + 500 };
  return id;
}

describe('flag capacity, removal and connections', () => {
  // Two carriers for three segments: goods pile up at (9,2), where the unstaffed segment starts.
  function jammed(): GameState {
    return run(stocked(relayGame(lane2), 12), 1500, { 0: network });
  }

  it(`stack up to ${content.logistics.flagCapacity} on a flag; a carrier bringing more waits`, () => {
    const s = jammed();
    const [, second] = carrierIds(s) as [number, number];
    const nine2 = tileIndex(s.map, 9, 2);
    expect(relayOf(s)?.waiting[nine2]).toHaveLength(content.logistics.flagCapacity);
    expect(s.components.villager[second]?.carrying).toEqual({ resource: 'logs', amount: 1 });
    expect(s.components.position[second]).toEqual({ x: 9500, y: 2500 });
    expect(relayOf(s)?.carriers[second]?.task).toEqual({ kind: 'carry', flag: nine2 });
    // Only the site's 10 logs left the buffer.
    expect(hutStock(s)).toBe(2);
    expect(logsInWorld(s)).toBe(12);

    // A third carrier staffs the last segment, and the site gets everything.
    addCarrier(s, 12, 4);
    const site = idsOf(s.components.site)[0] as number;
    const built = run(s, 2000);
    expect(built.components.building[site]?.type).toBe('hut');
    expect(relayOf(built)?.waiting).toEqual({});
  });

  it.each<[string, Command]>([
    ['the flag', { type: 'removeFlag', x: 9, y: 2 }],
    ['the path under it', { type: 'removePath', from: { x: 9, y: 2 }, to: { x: 9, y: 2 } }],
  ])("are lost when %s is removed, with the load of its segments' carriers", (_, command) => {
    const s0 = jammed();
    const [first, second] = carrierIds(s0) as [number, number];
    const nine2 = tileIndex(s0.map, 9, 2);
    const firstLoad = s0.components.villager[first]?.carrying?.amount ?? 0;

    const s = run(s0, 1, { [s0.tick]: [command] });
    expect(relayOf(s)?.waiting[nine2]).toBeUndefined();
    expect(s.components.villager[second]?.carrying).toBeNull();
    expect(relayOf(s)?.carriers[second]?.good ?? null).toBeNull();
    // 8 on the flag and 1 in the second carrier's hands; the first carrier keeps its load.
    expect(logsInWorld(s)).toBe(12 - 9);
    expect(s.components.villager[first]?.carrying?.amount ?? 0).toBe(firstLoad);
  });

  it('swap goods at a full flag rather than wait for a flag only they can empty', () => {
    // The woodcutter's hut door (7,2) is between a stockpile's flag (2,2) and a site's door (13,2).
    const hub: MapDef = {
      ...lane,
      buildings: [{ type: 'woodcutters_hut', x: 6, y: 0 }],
      villagers: [
        { job: 'carrier', x: 3, y: 5 },
        { job: 'carrier', x: 10, y: 5 },
      ],
    };
    const s0 = run(stocked(relayGame(hub), 20), 1, {
      0: [
        { type: 'layPath', from: { x: 1, y: 2 }, to: { x: 13, y: 2 } },
        { type: 'placeStockpile', x: 1, y: 3, w: 2, h: 2 },
        flagAt(2, 2),
        { type: 'placeBuilding', building: 'hut', x: 13, y: 1 },
      ],
    });
    // The stockpile's logs go to the site, while the buffer's fill the door flag bound the other way.
    const pile = idsOf(s0.components.stockpile)[0] as number;
    (s0.components.stockpile[pile] as StockpileComponent).goods[tileIndex(s0.map, 1, 3)] = {
      resource: 'logs',
      amount: 4,
    };
    const site = idsOf(s0.components.site)[0] as number;
    const s = runUntil(s0, (st) => st.components.building[site] !== undefined, 4000);
    expect(s.components.building[site]?.type).toBe('hut');
  });

  it('are kept when a flag is added to a segment while its carrier carries one', () => {
    const s0 = stocked(relayGame(lane3), 10);
    const middle = carrierIds(s0)[1] as number; // staffs (5,2)-(9,2)
    const carrying = runUntil(
      run(s0, 1, { 0: network }),
      (s) => relayOf(s)?.carriers[middle]?.task.kind === 'carry',
      1000,
    );
    const before = logsInWorld(carrying);
    const split = run(carrying, 1, { [carrying.tick]: [flagAt(7, 2)] });
    expect(segments(split)).toContain('5,2-7,2');
    expect(logsInWorld(split)).toBe(before);
    // With a carrier for the extra segment, every log reaches the site.
    addCarrier(split, 7, 4);
    const site = idsOf(split.components.site)[0] as number;
    const built = runUntil(split, (s) => s.components.building[site] !== undefined, 3000);
    expect(built.components.building[site]?.type).toBe('hut');
  });

  it("send nothing to a building whose door isn't connected to the source by road", () => {
    const s = run(stocked(relayGame(lane3), 10), 1000, {
      0: [
        road,
        flagAt(5, 2),
        // A site with its door (15,5) off the road.
        { type: 'placeBuilding', building: 'hut', x: 15, y: 4 },
        // A site on a road of its own, with its door (10,4) and a flag at (13,4).
        { type: 'layPath', from: { x: 10, y: 4 }, to: { x: 13, y: 4 } },
        flagAt(13, 4),
        { type: 'placeBuilding', building: 'hut', x: 10, y: 3 },
      ],
    });
    expect(idsOf(s.components.site)).toHaveLength(2);
    expect(segments(s)).toEqual(['1,2-5,2', '10,4-13,4']);
    for (const site of Object.values(s.components.site)) expect(site.delivered).toEqual({});
    expect(hutStock(s)).toBe(10);
    expect(relayOf(s)?.waiting).toEqual({});
  });
});

/** Goods of the stockpile with this ID, as "x,y": "resource amount". */
function goodsOf(s: GameState, id: number): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [i, g] of Object.entries(s.components.stockpile[id]?.goods ?? {})) {
    result[xy(s, Number(i))] = `${g.resource} ${g.amount}`;
  }
  return result;
}

describe('stockpile flags', () => {
  // A 3×2 stockpile just south of the road; the flag at (5,2) is next to its tile (5,3).
  const pileCommands: Command[] = [
    { type: 'layPath', from: { x: 1, y: 2 }, to: { x: 9, y: 2 } },
    { type: 'placeStockpile', x: 4, y: 3, w: 3, h: 2 },
    flagAt(5, 2),
  ];

  it('take goods onto the nearest tile with room, ties by tile index', () => {
    const s0 = run(stocked(relayGame(lane2), 10), 1, { 0: pileCommands });
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const [first] = carrierIds(s0) as [number];

    const one = runUntil(
      s0,
      (s) => Object.keys(s.components.stockpile[pile]?.goods ?? {}).length > 0,
      1000,
    );
    expect(goodsOf(one, pile)).toEqual({ '5,3': 'logs 1' });
    // The carrier walked onto that tile to unload.
    expect(one.components.position[first]).toEqual({ x: 5500, y: 3500 });

    // (5,3) fills up; then (4,3) and (6,3) are equally near, and (4,3) has the lower index.
    const pileTotal = (s: GameState) =>
      Object.values(s.components.stockpile[pile]?.goods ?? {}).reduce((n, g) => n + g.amount, 0);
    const all = runUntil(one, (s) => pileTotal(s) === 10, 3000);
    expect(goodsOf(all, pile)).toEqual({ '5,3': 'logs 8', '4,3': 'logs 2' });
  });

  it('give goods from the nearest tile holding them, ties by tile index', () => {
    const s0 = run(relayGame(lane2), 1, { 0: pileCommands });
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const goods = (s0.components.stockpile[pile] as StockpileComponent).goods;
    goods[tileIndex(s0.map, 4, 3)] = { resource: 'logs', amount: 3 };
    goods[tileIndex(s0.map, 6, 3)] = { resource: 'logs', amount: 3 };
    goods[tileIndex(s0.map, 5, 4)] = { resource: 'logs', amount: 8 };
    const [, second] = carrierIds(s0) as [number, number];

    // A hut site with its door (9,2) at the end of the road: the segment (5,2)-(9,2) serves it.
    const placed = run(s0, 1, {
      [s0.tick]: [{ type: 'placeBuilding', building: 'hut', x: 9, y: 1 }],
    });
    const loaded = runUntil(placed, (s) => s.components.villager[second]?.carrying !== null, 1000);
    expect(loaded.components.position[second]).toEqual({ x: 4500, y: 3500 });
    expect(goodsOf(loaded, pile)).toEqual({ '4,3': 'logs 2', '6,3': 'logs 3', '5,4': 'logs 8' });

    const site = idsOf(placed.components.site)[0] as number;
    const built = runUntil(loaded, (s) => s.components.building[site] !== undefined, 5000);
    expect(built.components.building[site]?.type).toBe('hut');
    expect(logsInWorld(built)).toBe(14 - 10);
  });

  it('take goods left on their flag, fetched by a carrier waiting at the far end', () => {
    // Both carriers wait at the far ends of their segments, (1,2) and (9,2).
    const s0 = run(relayGame(lane2), 300, { 0: [...pileCommands, flagAt(9, 2)] });
    const five2 = tileIndex(s0.map, 5, 2);
    expect(relayOf(s0)?.carriers[3]?.task).toEqual({ kind: 'idle', flag: tileIndex(s0.map, 1, 2) });
    // A log with nowhere to go, as when the site it was bound for is cancelled.
    (relayOf(s0) as FlagRelayState).waiting[five2] = [{ resource: 'logs', to: null }];
    const pile = idsOf(s0.components.stockpile)[0] as number;
    const s = run(s0, 300);
    expect(goodsOf(s, pile)).toEqual({ '5,3': 'logs 1' });
  });

  it('only serve stockpiles next to them', () => {
    // The flag at (8,2) isn't next to the stockpile, so the logs have nowhere to go.
    const s = run(stocked(relayGame(lane2), 4), 1000, {
      0: [...pileCommands.slice(0, 2), flagAt(8, 2)],
    });
    expect(goodsOf(s, idsOf(s.components.stockpile)[0] as number)).toEqual({});
    expect(hutStock(s)).toBe(4);
  });
});

describe('goods whose destination goes', () => {
  it('are sent somewhere else that wants them', () => {
    // The lane network plus a stockpile served by the flag at (5,2). Sites come first, so every
    // log is bound for the site until it's cancelled.
    const s0 = run(stocked(relayGame(lane3), 10), 300, {
      0: [...network, { type: 'placeStockpile', x: 4, y: 3, w: 3, h: 2 }],
    });
    const site = idsOf(s0.components.site)[0] as number;
    const pile = idsOf(s0.components.stockpile)[0] as number;
    expect(goodsOf(s0, pile)).toEqual({});
    const onTheWay = Object.values(relayOf(s0)?.waiting ?? {}).flat().length;
    expect(onTheWay).toBeGreaterThan(0);

    const cancelled = run(s0, 1, { [s0.tick]: [{ type: 'cancelConstruction', siteId: site }] });
    const left = logsInWorld(cancelled);
    const settled = run(cancelled, 3000);
    // Every log still around ends up on the stockpile.
    const pileTotal = Object.values(settled.components.stockpile[pile]?.goods ?? {}).reduce(
      (n, g) => n + g.amount,
      0,
    );
    expect(pileTotal).toBe(left);
    expect(relayOf(settled)?.waiting).toEqual({});
  });
});

describe('flag relay runs', () => {
  // A branching network with a stockpile, a site, a removed flag and a cancelled second site.
  const script: Record<number, Command[]> = {
    0: [
      ...network,
      { type: 'placeStockpile', x: 4, y: 3, w: 3, h: 2 },
      { type: 'layPath', from: { x: 9, y: 3 }, to: { x: 9, y: 5 } },
      flagAt(9, 5),
    ],
    200: [{ type: 'placeBuilding', building: 'hut', x: 10, y: 4 }], // door (10,5), off the road
    400: [{ type: 'layPath', from: { x: 10, y: 5 }, to: { x: 11, y: 5 } }],
    700: [{ type: 'removeFlag', x: 9, y: 2 }],
    900: [flagAt(9, 2)],
    1200: [{ type: 'cancelConstruction', siteId: 8 }],
  };
  const fresh = () => stocked(relayGame(lane3), 30);

  it('is deterministic', () => {
    const a = run(fresh(), 2000, script);
    const b = run(fresh(), 2000, script);
    expect(a).toEqual(b);
    // The script did what it says: IDs are hut 1, woodcutter 2, carriers 3-5, site 6,
    // stockpile 7, second site 8.
    expect(a.components.building[6]?.type).toBe('hut');
    expect(a.components.site[8]).toBeUndefined();
    expect(Object.keys(a.components.stockpile[7]?.goods ?? {}).length).toBeGreaterThan(0);
  });

  it.each([150, 800])('saved and loaded at tick %i, continues like an uninterrupted run', (at) => {
    const uninterrupted = run(fresh(), 2000, script);
    const midway = run(fresh(), at, script);
    // Goods really are on their way at the save.
    const inHands = carrierIds(midway).filter((id) => midway.components.villager[id]?.carrying);
    expect(inHands.length + Object.keys(relayOf(midway)?.waiting ?? {}).length).toBeGreaterThan(0);
    const resumed = run(deserialize(serialize(midway)), 2000 - at, script);
    expect(resumed).toEqual(uninterrupted);
  });
});
