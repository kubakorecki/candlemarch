// Fisher's hut: fish from the river at a riverbank door; the river freezes in winter.
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/** 8×7 with a river along row 3. A fisher's hut at (x, 1) has its door (x, 2) on the north bank. */
const bank: MapDef = {
  name: 'bank',
  rows: ['........', '........', '........', '~~~~~~~~', '........', '........', '........'],
  buildings: [],
  villagers: [],
};

describe("fisher's hut placement", () => {
  it('needs its door on a riverbank tile', () => {
    const s = createInitialState(1, bank, content);
    // Door (0,2), next to the river at (0,3).
    expect(canPlaceBuilding(s, content, 'fishers_hut', 0, 1)).toBe(true);
    expect(canPlaceBuilding(s, content, 'fishers_hut', 5, 1)).toBe(true);
    // One tile back from the bank: the door (0,1) isn't on it.
    expect(canPlaceBuilding(s, content, 'fishers_hut', 0, 0)).toBe(false);
    // South of the river the hut itself is on the bank, but its door (0,5) isn't.
    expect(canPlaceBuilding(s, content, 'fishers_hut', 0, 4)).toBe(false);
    // Other buildings don't care.
    expect(canPlaceBuilding(s, content, 'hut', 0, 4)).toBe(true);
  });

  it('fits on either bank of a river running north to south', () => {
    const s = createInitialState(
      1,
      { ...bank, rows: ['...~...', '...~...', '...~...', '...~...'] },
      content,
    );
    expect(canPlaceBuilding(s, content, 'fishers_hut', 2, 1)).toBe(true); // door (2,2), west bank
    expect(canPlaceBuilding(s, content, 'fishers_hut', 4, 1)).toBe(true); // door (4,2), east bank
    expect(canPlaceBuilding(s, content, 'fishers_hut', 1, 1)).toBe(false);
  });

  it('keeps maps from starting with one off the bank', () => {
    const inland = { ...bank, buildings: [{ type: 'fishers_hut' as const, x: 0, y: 4 }] };
    expect(() => createInitialState(1, inland, content)).toThrow(/fishers_hut/);
  });
});

/** The bank with a fisher's hut at (0,1) (door (0,2)), its fisher, a stockpile and a carrier. */
const fishery: MapDef = {
  ...bank,
  name: 'fishery',
  buildings: [{ type: 'fishers_hut', x: 0, y: 1 }],
  stockpiles: [{ x: 4, y: 0, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 6, y: 1 }],
};

const fishes = content.buildings.fishers_hut.fishes ?? { catchTicks: 0, yieldPerCatch: 0 };
const capacity = content.buildings.fishers_hut.outputBuffer?.capacity ?? 0;

function hutFish(s: GameState): number {
  const hut = idsOf(s.components.building).find(
    (id) => s.components.building[id]?.type === 'fishers_hut',
  );
  return hut === undefined ? 0 : (s.components.building[hut]?.stock.fish ?? 0);
}

describe('fishing', () => {
  it("puts a catch in the hut's buffer every catchTicks", () => {
    const s0 = createInitialState(1, fishery, content);
    // The fisher starts at the door: one tick to start, then the catch.
    expect(hutFish(run(s0, fishes.catchTicks))).toBe(0);
    expect(hutFish(run(s0, fishes.catchTicks + 1))).toBe(fishes.yieldPerCatch);
    expect(hutFish(run(s0, 2 * fishes.catchTicks + 2))).toBe(2 * fishes.yieldPerCatch);
  });

  it('stops while the buffer is full, and Food never goes to a Stockpile', () => {
    const s0 = createInitialState(1, fishery, content);
    const full = runUntil(s0, (s) => hutFish(s) === capacity, 10 * fishes.catchTicks);
    expect(hutFish(full)).toBe(capacity);
    const later = run(full, 3 * fishes.catchTicks);
    expect(hutFish(later)).toBe(capacity);
    expect(Object.keys(later.logistics.hauls)).toEqual([]);
    for (const pile of Object.values(later.components.stockpile)) expect(pile.goods).toEqual({});
  });
});

describe('the frozen river', () => {
  // Winter is the fourth season: days 16 to 20. Spring of year 2 begins at Dawn of day 21.
  const freeze = dawnTick(16, content);
  const thaw = dawnTick(21, content);

  /** The fishery at `tick`, its fisher at the door. */
  function fisheryAt(tick: number): GameState {
    const s = createInitialState(1, fishery, content);
    s.tick = tick;
    return s;
  }

  it('gives no fish all winter; a catch under way when it freezes is lost', () => {
    // The first catch starts 100 ticks before the freeze and would end 300 ticks into winter.
    const s0 = fisheryAt(freeze - 100);
    const winter = run(s0, thaw - s0.tick);
    expect(winter.tick).toBe(thaw);
    expect(hutFish(winter)).toBe(0);
    expect(winter.components.fisher[idsOf(winter.components.fisher)[0] as number]?.kind).toBe(
      'idle',
    );
  });

  it('thaws in spring, and fishing starts again', () => {
    const s0 = fisheryAt(thaw - 10);
    // Frozen for 10 ticks, then up to one idle retry before the first catch starts.
    const idleRetry = content.jobs.fisher.idleRetryTicks;
    expect(hutFish(run(s0, 10 + fishes.catchTicks))).toBe(0);
    expect(hutFish(run(s0, 10 + idleRetry + fishes.catchTicks + 1))).toBe(1);
  });

  it('saved and loaded mid-catch, carries on exactly as an uninterrupted run', () => {
    const s0 = createInitialState(1, fishery, content);
    const mid = run(s0, fishes.catchTicks / 2);
    expect(mid.components.fisher[idsOf(mid.components.fisher)[0] as number]?.kind).toBe('fishing');
    const loaded = deserialize(serialize(mid), content);
    expect(run(loaded, 2 * fishes.catchTicks)).toEqual(
      run(s0, fishes.catchTicks / 2 + 2 * fishes.catchTicks),
    );
  });
});
