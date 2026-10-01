// The farm and its Fields (spec, Resources: Farms and crops): Fields painted on Meadow in a farm's
// radius are sown in spring, ripe about a season later, harvested once from late summer through
// autumn, and lost if still standing at winter's first Dawn. Fieldstones come up each spring and
// leave through the yard as stone. Grain is Food.
import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { dawnTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { fieldAt } from '../src/fields';
import { canPlant } from '../src/forest';
import { villageFood } from '../src/granary';
import { cantUseWorkers } from '../src/logistics/helping';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import { applyStaticPatch, sentStaticLayers, staticLayers, staticPatch } from '../src/snapshot';
import type { FieldStage, GameState, Tile } from '../src/state';
import { cloneState, stepInPlace } from '../src/step';
import { amountOnTile } from '../src/stockpiles';
import { content, run } from './helpers';

/**
 * 14×10 Meadow with Rock at (5,7). A farm at (1,1) (ID 1: body x 1–2, y 1–2, door (1,3), yard
 * (2,3), radius 5: x ≤ 7, y ≤ 7) and its farmers 2 and 3, a Granary at (10,1) (ID 4) with 60
 * fish, a Hut at (12,6) (ID 5), a 2×2 Stockpile at (9,6) (ID 6) and a Carrier (ID 7).
 */
const acre: MapDef = {
  name: 'acre',
  rows: [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.....:........',
    '..............',
    '..............',
  ],
  buildings: [
    { type: 'farm', x: 1, y: 1 },
    { type: 'granary', x: 10, y: 1, stock: [{ resource: 'fish', amount: 60 }] },
    { type: 'hut', x: 12, y: 6 },
  ],
  stockpiles: [{ x: 9, y: 6, w: 2, h: 2 }],
  villagers: [{ job: 'carrier', x: 8, y: 8 }],
};
const FARM = 1;
const GRANARY = 4;
const STOCKPILE = 6;

/** The rectangle the tests paint: x 4–8, y 4–7. The farm's radius stops at x 7; (5,7) is Rock. */
const PAINT: Command = {
  type: 'paintFields',
  farm: FARM,
  from: { x: 4, y: 4 },
  to: { x: 8, y: 7 },
};
/** The Fields it paints: x 4–7, y 4–7 but the Rock. */
const FIELDS: Tile[] = [4, 5, 6, 7]
  .flatMap((y) => [4, 5, 6, 7].map((x) => ({ x, y })))
  .filter((t) => !(t.x === 5 && t.y === 7));

/** Nothing spoils, and fish is eaten before grain: the Granary keeps every harvest. */
const keeping: Content = {
  ...content,
  resources: {
    ...content.resources,
    fish: { ...content.resources.fish, storage: 'granary', spoilPercent: 0 },
    grain: { ...content.resources.grain, storage: 'granary', spoilPercent: 0 },
  },
};

/** Steps `s` (a copy) in place until `done` or `max` ticks, with `c`. */
function play(
  s: GameState,
  done: (s: GameState) => boolean,
  max: number,
  c: Content = keeping,
): GameState {
  const next = cloneState(s);
  for (let i = 0; i < max && !done(next); i++) stepInPlace(next, [], c);
  return next;
}

/** `s` jumped to the Dawn of `day` and run through it. */
const dawnOf = (s: GameState, day: number) =>
  run({ ...s, tick: dawnTick(day, content) }, 1, {}, keeping);

const stages = (s: GameState) => FIELDS.map((t) => fieldAt(s, t)?.stage);
const all = (s: GameState, stage: FieldStage) => stages(s).every((st) => st === stage);
const grainIn = (s: GameState) => s.components.building[GRANARY]?.stock.grain ?? 0;

/** The acre with its Fields painted on the first tick. */
const painted = () => run(createInitialState(1, acre, content), 1, { 0: [PAINT] }, keeping);

/** The acre a day into spring, every Field sown. */
const sown = () => play(painted(), (s) => all(s, 'sown'), 3600);

describe('Fields', () => {
  it('are painted on open Meadow in the farm’s radius only, and erased', () => {
    const s = painted();
    expect(Object.keys(s.map.fields)).toHaveLength(FIELDS.length);
    for (const t of FIELDS) expect(fieldAt(s, t)?.stage).toBe('bare');
    expect(fieldAt(s, { x: 8, y: 5 })).toBeUndefined(); // out of its radius
    expect(fieldAt(s, { x: 5, y: 7 })).toBeUndefined(); // Rock
    // Not on the farm, its door or yard either.
    const onFarm = run(s, 1, {
      [s.tick]: [{ type: 'paintFields', farm: FARM, from: { x: 0, y: 0 }, to: { x: 3, y: 3 } }],
    });
    expect(fieldAt(onFarm, { x: 1, y: 1 })).toBeUndefined();
    expect(fieldAt(onFarm, { x: 1, y: 3 })).toBeUndefined();
    expect(fieldAt(onFarm, { x: 2, y: 3 })).toBeUndefined();
    expect(fieldAt(onFarm, { x: 0, y: 0 })?.stage).toBe('bare');

    const erased = run(s, 1, {
      [s.tick]: [{ type: 'eraseFields', from: { x: 4, y: 4 }, to: { x: 5, y: 5 } }],
    });
    expect(Object.keys(erased.map.fields)).toHaveLength(FIELDS.length - 4);
  });

  it('give way to a building, Road or Stockpile put on them', () => {
    const s = run(painted(), 1, {
      1: [
        { type: 'layPath', from: { x: 4, y: 4 }, to: { x: 7, y: 4 } },
        { type: 'placeStockpile', x: 4, y: 6, w: 1, h: 1 },
      ],
    });
    expect(fieldAt(s, { x: 5, y: 4 })).toBeUndefined();
    expect(fieldAt(s, { x: 4, y: 6 })).toBeUndefined();
    expect(fieldAt(s, { x: 5, y: 5 })?.stage).toBe('bare');
  });

  it('are no place for a forester to plant', () => {
    // A forester's lodge at (12,0) (ID 6, after the Hut): radius 6 reaches x 6.
    const lodge = { type: 'foresters_lodge' as const, x: 12, y: 0 };
    const s0 = createInitialState(
      1,
      { ...acre, buildings: [...(acre.buildings ?? []), lodge] },
      content,
    );
    expect(canPlant(s0, content, 6, { x: 6, y: 4 })).toBe(true);
    const s = run(s0, 1, { 0: [PAINT] });
    expect(fieldAt(s, { x: 6, y: 4 })?.stage).toBe('bare');
    expect(canPlant(s, content, 6, { x: 6, y: 4 })).toBe(false);
  });

  it('travel to the client in the static layers', () => {
    const s0 = createInitialState(1, acre, content);
    const sent = sentStaticLayers(s0);
    const layers = staticLayers(s0);
    const s = painted();
    const patch = staticPatch(sent, s);
    expect(patch.fields).toEqual(s.map.fields);
    expect(applyStaticPatch(layers, patch).fields).toEqual(s.map.fields);
    expect(staticPatch(sent, s).fields).toBeNull();
  });
});

describe('a year on the farm', () => {
  it('sows every Field in spring with the farm’s Crop', () => {
    const s = sown();
    expect(s.tick).toBeLessThan(dawnTick(2, content));
    for (const t of FIELDS) expect(fieldAt(s, t)?.crop).toBe('grain');
  });

  it('ripens a sown Field at the first Dawn growDays after sowing, in summer', () => {
    const s = sown();
    // Sown on day 1, so ripe at day 9's Dawn (summer's 4th day), not before.
    const day = 1 + content.crops.grain.growDays + 1;
    expect(all(dawnOf(s, day - 1), 'sown')).toBe(true);
    expect(all(dawnOf(s, day), 'ripe')).toBe(true);
  });

  it('harvests each ripe Field once, into the yard and on to the Granary', () => {
    const ripe = dawnOf(sown(), 9);
    const s = play(ripe, (x) => all(x, 'stubble') && grainIn(x) === FIELDS.length * 3, 3 * 3600);
    expect(grainIn(s)).toBe(FIELDS.length * content.crops.grain.yieldPerField);
    // Harvested Fields stay stubble: nothing more grows or is sown this year.
    const later = play(s, () => false, 3600);
    expect(all(later, 'stubble')).toBe(true);
    expect(grainIn(later)).toBe(grainIn(s));
  });

  it('loses what is unharvested at winter’s first Dawn, and does nothing in winter', () => {
    // The farmers are taken off before the harvest.
    const ripe = run(dawnOf(sown(), 9), 1, {
      [dawnTick(9, content) + 1]: [{ type: 'setWorkerLimit', building: FARM, limit: 0 }],
    });
    const autumn = dawnOf(ripe, 15);
    expect(all(autumn, 'ripe')).toBe(true);
    const winter = dawnOf(autumn, 16);
    expect(all(winter, 'bare')).toBe(true);
    for (const t of FIELDS) expect(fieldAt(winter, t)?.crop).toBeNull();
    expect(grainIn(winter)).toBe(0);

    // With farmers back and a Fieldstone on a Field, still nothing is done all winter.
    const back = run(winter, 1, {
      [winter.tick]: [{ type: 'setWorkerLimit', building: FARM, limit: 2 }],
    });
    const field = fieldAt(back, { x: 4, y: 4 });
    if (field) field.stone = true;
    const end = play(back, () => false, 3 * 3600);
    expect(all(end, 'bare')).toBe(true);
    expect(fieldAt(end, { x: 4, y: 4 })?.stone).toBe(true);
    expect(cantUseWorkers(end, keeping, FARM)).toBe(true);
  });

  it('lets its farmers help carry while the Fields grow', () => {
    const s = play(sown(), () => false, 200);
    expect(cantUseWorkers(s, keeping, FARM)).toBe(true);
  });

  it('sows nothing while paused by its standing order', () => {
    const s0 = createInitialState(1, acre, content);
    const s = play(
      run(s0, 1, { 0: [PAINT, { type: 'setStandingOrder', building: FARM, amount: 0 }] }, keeping),
      () => false,
      2000,
    );
    expect(all(s, 'bare')).toBe(true);
  });

  it('is deterministic, and a save mid-year plays on the same', () => {
    const a = play(sown(), () => false, 3000);
    const b = play(sown(), () => false, 3000);
    expect(a).toEqual(b);
    const mid = dawnOf(sown(), 9);
    const straight = play(mid, () => false, 2000);
    const loaded = play(deserialize(serialize(mid), content), () => false, 2000);
    expect(loaded).toEqual(straight);
  });
});

describe('Fieldstones', () => {
  /** Painted on day 1, then jumped to the next spring's first Dawn (day 21) and run through it. */
  const nextSpring = () => dawnOf(painted(), 21);
  const stones = (s: GameState) => FIELDS.filter((t) => fieldAt(s, t)?.stone).length;
  /** Stone out of the Fields: in the farm's yard, in hand or on the Stockpile. */
  const stoneOut = (s: GameState) => {
    const pile = s.components.stockpile[STOCKPILE];
    const piled = pile
      ? Object.keys(pile.goods).reduce((n, i) => n + amountOnTile(pile, Number(i), 'stone'), 0)
      : 0;
    const carried = Object.values(s.components.villager).reduce(
      (n, v) => n + (v.carrying?.resource === 'stone' ? v.carrying.amount : 0),
      0,
    );
    return piled + carried + (s.components.building[FARM]?.stock.stone ?? 0);
  };

  it('come up on about 1 Field in 4 at the first Dawn of spring', () => {
    const n = stones(nextSpring());
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(8);
    expect(stones(painted())).toBe(0);
  });

  it('are cleared before their Field is sown, and leave the farm as stone', () => {
    let s = nextSpring();
    const n = stones(s);
    let sownOnStone = false;
    s = play(
      s,
      (x) => {
        sownOnStone ||= FIELDS.some((t) => fieldAt(x, t)?.stone && fieldAt(x, t)?.stage !== 'bare');
        return all(x, 'sown');
      },
      3600,
    );
    expect(sownOnStone).toBe(false);
    expect(stones(s)).toBe(0);
    expect(stoneOut(s)).toBe(n);
  });
});

describe('grain', () => {
  it('is Food: counted with the village’s Food and eaten as Meals', () => {
    const s0 = createInitialState(1, acre, content);
    const granary = s0.components.building[GRANARY];
    if (granary) granary.stock = { grain: 30 };
    expect(villageFood(s0, content)).toBe(30);
    // Through the first Dusk and the Meal after it: the three villagers each eat grain.
    const s = play(s0, (x) => x.tick > dawnTick(2, content), 4000, content);
    expect(grainIn(s)).toBeLessThan(30);
    for (const v of Object.values(s.components.villager)) expect(v.missedMeals).toBe(0);
  });
});
