// Warmth: Houses stock firewood from the start of autumn and burn it on winter nights. A winter
// night in a cold House or in the open makes a villager Cold (slower) until a warm night.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { stockpileTileIndices } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import { speedPercent } from '../src/speed';
import type { EntityId, GameState } from '../src/state';
import { addToTile } from '../src/stockpiles';
import { isPaused } from '../src/systems/production';
import { content, run } from './helpers';

/**
 * A Hut at (2,0) (door (2,1)), a 2×2 stockpile at (6,3) and a Carrier at (4,3), who lives in the
 * Hut. IDs: Hut 1, stockpile 2, Carrier 3.
 */
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 6 }, () => '..........'),
  buildings: [{ type: 'hut', x: 2, y: 0 }],
  stockpiles: [{ x: 6, y: 3, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 4, y: 3 }],
};
/** The camp without its Hut. IDs: stockpile 1, Carrier 2. */
const openCamp: MapDef = { ...camp, buildings: [] };

const HUT = 1;
const CARRIER = 3;

// 5 days a season: summer is days 6-10, autumn 11-15, winter 16-20, spring 21-25.
const SUMMER_DAY = 10;
const AUTUMN_DAY = 11;
const WINTER_DAY = 16;

/** A copy of `s` moved on to `tick`, as if the time between had passed with nothing happening. */
function jump(s: GameState, tick: number): GameState {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  copy.tick = tick;
  return copy;
}

/** The camp with `firewood` on its stockpile, 8 to a tile. */
function fresh(firewood = 16, map: MapDef = camp): GameState {
  const s = createInitialState(1, map, content);
  const pileId = Number(Object.keys(s.components.stockpile)[0]);
  const pile = s.components.stockpile[pileId];
  if (!pile) throw new Error('no stockpile');
  let left = firewood;
  for (const i of stockpileTileIndices(s, pileId)) {
    const amount = Math.min(8, left);
    if (amount > 0) addToTile(pile, i, { resource: 'firewood', amount });
    left -= amount;
  }
  return s;
}

/** `s` with the Hut holding `firewood`. */
function stocked(s: GameState, firewood: number): GameState {
  const hut = s.components.building[HUT];
  if (hut) hut.stock.firewood = firewood;
  return s;
}

const hutFirewood = (s: GameState) => s.components.building[HUT]?.stock.firewood ?? 0;
const coldNights = (s: GameState, id: EntityId) => s.components.villager[id]?.coldNights;

/**
 * Speed of villager `id` in `s` from Cold alone: the camp has no Granary, so everyone is Hungry
 * after a night, and Tired too if they got home late.
 */
function speedWhenFed(s: GameState, id: EntityId): number {
  const copy = JSON.parse(JSON.stringify(s)) as GameState;
  const v = copy.components.villager[id];
  if (v) {
    v.missedMeals = 0;
    v.tired = false;
  }
  return speedPercent(copy, content, id);
}

/** Runs from the Dusk of day `day` (jumped to) to just after the next Dawn. */
function night(s: GameState, day: number): GameState {
  return run(
    jump(s, duskTick(day, content)),
    dawnTick(day + 1, content) + 1 - duskTick(day, content),
  );
}

describe('firewood for Houses', () => {
  it('is not asked for in summer', () => {
    const s = run(jump(fresh(), dawnTick(SUMMER_DAY, content) + 1), 600);
    expect(hutFirewood(s)).toBe(0);
  });

  it('is delivered from the start of autumn, up to the buffer', () => {
    const s = run(jump(fresh(), dawnTick(AUTUMN_DAY, content) + 1), 1200);
    expect(hutFirewood(s)).toBe(content.needs.cold.houseBuffer);
  });
});

describe('winter nights', () => {
  it('an occupied House burns firewood at Dusk and its residents stay warm', () => {
    const s = night(stocked(fresh(0), 5), WINTER_DAY);
    expect(hutFirewood(s)).toBe(4);
    expect(coldNights(s, CARRIER)).toBe(0);
    expect(speedWhenFed(s, CARRIER)).toBe(100);
  });

  it('a House without firewood goes cold, and its residents become Cold', () => {
    const s = night(fresh(0), WINTER_DAY);
    expect(coldNights(s, CARRIER)).toBe(1);
    expect(speedWhenFed(s, CARRIER)).toBe(content.needs.cold.speedPercent);
  });

  it('a Cold villager recovers after a warm night', () => {
    const cold = night(fresh(0), WINTER_DAY);
    const warm = night(stocked(cold, 5), WINTER_DAY + 1);
    expect(coldNights(warm, CARRIER)).toBe(0);
  });

  it('no firewood is burned outside winter', () => {
    const s = night(stocked(fresh(0), 5), AUTUMN_DAY);
    expect(hutFirewood(s)).toBe(5);
    expect(coldNights(s, CARRIER)).toBe(0);
  });

  it('Homeless villagers get cold in winter only', () => {
    const OPEN_CARRIER = 2;
    expect(coldNights(night(fresh(0, openCamp), AUTUMN_DAY), OPEN_CARRIER)).toBe(0);
    expect(coldNights(night(fresh(0, openCamp), WINTER_DAY), OPEN_CARRIER)).toBe(1);
  });
});

describe('the firewood target', () => {
  it('counts firewood in House buffers', () => {
    const map: MapDef = {
      ...camp,
      buildings: [...camp.buildings, { type: 'chopping_block', x: 0, y: 4 }],
      stockpiles: [{ x: 6, y: 3, w: 3, h: 2 }],
    };
    const s = fresh(36, map);
    const block = Number(
      Object.keys(s.components.building).find(
        (id) => s.components.building[Number(id)]?.type === 'chopping_block',
      ),
    );
    expect(content.buildings.chopping_block.stockTarget?.amount).toBe(40);
    expect(isPaused(s, content, block)).toBe(false);
    expect(isPaused(stocked(s, 4), content, block)).toBe(true);
  });
});

describe('determinism and saves', () => {
  /** A winter morning with 1 firewood to deliver: a warm night, then a cold one. */
  const start = () => jump(fresh(1), dawnTick(WINTER_DAY, content) + 1);
  const end = dawnTick(WINTER_DAY + 2, content) + 1;

  it('runs the same twice', () => {
    const a = run(start(), end - start().tick);
    const b = run(start(), end - start().tick);
    expect(a).toEqual(b);
    expect(hutFirewood(a)).toBe(0);
    expect(coldNights(a, CARRIER)).toBe(1);
  });

  it('continues a save made mid-night like an uninterrupted run', () => {
    const s = start();
    const whole = run(s, end - s.tick);
    const midNight = run(s, duskTick(WINTER_DAY, content) + 200 - s.tick);
    const loaded = deserialize(serialize(midNight), content);
    expect(run(loaded, end - midNight.tick)).toEqual(whole);
  });
});
