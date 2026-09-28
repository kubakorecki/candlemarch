// Watchtowers: the Watchman's night shift (eat at Dusk, stand in the tower till Dawn, sleep at Home
// by day) and the tower shooting Gloamlings in range while its Watchman is in it.
import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { healthBars } from '../src/combat';
import { createEntity, destroyEntity } from '../src/entities';
import { tileCenter, tileOfPoint } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Point, Tile } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * 20×7 grass: a Hut at (2,0) (ID 1, door (2,1)), a Granary with fish at (6,0) (ID 2, door (7,2))
 * and a watchtower at (12,2) (ID 3, door (12,3)) whose Watchman (ID 4) starts at its door.
 */
const post: MapDef = {
  name: 'post',
  rows: Array.from({ length: 7 }, () => '.'.repeat(20)),
  buildings: [
    { type: 'hut', x: 2, y: 0 },
    { type: 'granary', x: 6, y: 0, stock: [{ resource: 'fish', amount: 10 }] },
    { type: 'watchtower', x: 12, y: 2 },
  ],
  villagers: [],
};
const HUT_DOOR = { x: 2, y: 1 };
const GRANARY = 2;
const TOWER_DOOR = { x: 12, y: 3 };
const WATCHMAN = 4;

function tileOf(s: GameState, id: EntityId) {
  return tileOfPoint(s.components.position[id] as Point);
}

function watchman(s: GameState) {
  const v = s.components.villager[WATCHMAN];
  if (!v) throw new Error('no Watchman');
  return v;
}

/** Runs from the state's tick up to (not including) tick `t`. */
function runTo(s: GameState, t: number): GameState {
  return run(s, t - s.tick);
}

describe("the Watchman's night shift", () => {
  it('sleeps at Home by day, eats at Dusk, stands in the tower till Dawn, then goes Home', () => {
    const s = createInitialState(1, post, content);
    expect(watchman(s).job).toBe('watchman');

    const day = runTo(s, duskTick(1, content));
    expect(watchman(day).routine).toBe('asleep');
    expect(tileOf(day, WATCHMAN)).toEqual(HUT_DOOR);
    expect(watchman(day).sleptTicks).toBeGreaterThan(0);

    const onWatch = runUntil(day, (x) => watchman(x).routine === 'onWatch', 600);
    expect(watchman(onWatch).routine).toBe('onWatch');
    expect(tileOf(onWatch, WATCHMAN)).toEqual(TOWER_DOOR);
    expect(watchman(onWatch).missedMeals).toBe(0);
    expect(onWatch.components.building[GRANARY]?.stock.fish).toBe(
      10 - content.needs.hungry.mealUnits,
    );

    const lastOfNight = runTo(onWatch, dawnTick(2, content));
    expect(watchman(lastOfNight).routine).toBe('onWatch');
    expect(tileOf(lastOfNight, WATCHMAN)).toEqual(TOWER_DOOR);

    const home = runUntil(lastOfNight, (x) => watchman(x).routine === 'asleep', 600);
    expect(watchman(home).routine).toBe('asleep');
    expect(tileOf(home, WATCHMAN)).toEqual(HUT_DOOR);
    expect(watchman(home).missedMeals).toBe(0);
  });

  it("isn't Cold after a winter night in the tower", () => {
    // Day 16 is winter's first; the Hut has no firewood.
    const s = createInitialState(1, post, content);
    s.tick = duskTick(16, content);
    const morning = runTo(s, dawnTick(17, content) + 1);
    expect(watchman(morning).coldNights).toBe(0);
    expect(morning.components.building[1]?.cold).toBe(false); // reset at Dawn
  });

  it('carries on from a save made mid-shift', () => {
    const s = runTo(createInitialState(1, post, content), duskTick(1, content) + 100);
    expect(watchman(s).routine).not.toBe('asleep');
    const loaded = deserialize(serialize(s), content);
    expect(run(loaded, 1800)).toEqual(run(s, 1800));
  });

  it('is Tired from too little sleep at Home by day, not from the night on watch', () => {
    const s = createInitialState(1, post, content);
    const rested = runTo(s, duskTick(1, content) + 1);
    expect(watchman(rested).tired).toBe(false);
    // A whole night in the tower doesn't make it Tired the next day.
    const morning = runTo(rested, dawnTick(2, content) + 1);
    expect(watchman(morning).tired).toBe(false);

    // Woken and put at the tower door halfway through the day: what's left of it, asleep at
    // Home after the walk back, is short of half the day.
    const awake = runTo(morning, dawnTick(2, content) + 1200);
    awake.components.position[WATCHMAN] = tileCenter(TOWER_DOOR);
    delete awake.components.path[WATCHMAN];
    watchman(awake).routine = 'goingHome';
    watchman(awake).sleptTicks = 0;
    const dusk = runTo(awake, duskTick(2, content) + 1);
    expect(watchman(dusk).sleptTicks).toBe(0); // counting starts again at Dusk
    expect(watchman(dusk).tired).toBe(true);
    // Tired all night, rested again at Dawn.
    expect(watchman(runTo(dusk, dawnTick(3, content) - 1)).tired).toBe(true);
    expect(watchman(runTo(dusk, dawnTick(3, content) + 1)).tired).toBe(false);
  });

  it('is Tired at Dusk when Homeless: it never sleeps at Home', () => {
    const s = createInitialState(1, { ...post, buildings: post.buildings.slice(1) }, content);
    // No Hut (IDs shift down by one): it sleeps where it stands.
    const dusk = runTo(s, duskTick(1, content) + 1);
    expect(dusk.components.villager[3]?.tired).toBe(true);
  });
});

/**
 * 20×9 grass at night, nothing but a watchtower at (6,4) (ID 1) with its Watchman (ID 2) on watch
 * at its door (6,5), and a Gloamling (IDs from 3) standing at each of `at`. With no House and
 * nobody out in the open, the Gloamlings have nothing to go for and stand still.
 */
function towerAtNight(at: Tile[], onWatch = true): GameState {
  const s = createInitialState(
    1,
    {
      name: 'watch',
      rows: Array.from({ length: 9 }, () => '.'.repeat(20)),
      buildings: [{ type: 'watchtower', x: 6, y: 4 }],
      villagers: [],
    },
    content,
  );
  s.tick = duskTick(1, content) + 10;
  const v = s.components.villager[2];
  if (v && onWatch) v.routine = 'onWatch';
  for (const t of at) {
    const id = createEntity(s);
    s.components.gloamling[id] = {
      den: 0,
      hp: content.combat.gloamling.hp,
      readyAt: 0,
      target: null,
    };
    s.components.position[id] = tileCenter(t);
  }
  return s;
}

function hpOf(s: GameState, id: EntityId): number | undefined {
  return s.components.gloamling[id]?.hp;
}

describe('the watchtower', () => {
  const { damage, cooldownTicks, rangeTiles } = content.buildings.watchtower.watch ?? {
    damage: 0,
    cooldownTicks: 0,
    rangeTiles: 0,
  };
  const FULL = content.combat.gloamling.hp;

  it('shoots a Gloamling in range while its Watchman is in it, and ignores one outside', () => {
    // One Gloamling at the edge of range, one a tile past it.
    const s = towerAtNight([
      { x: 6 + rangeTiles, y: 4 },
      { x: 6 + rangeTiles + 1, y: 8 },
    ]);
    const first = run(s, 1);
    expect(hpOf(first, 3)).toBe(FULL - damage);
    expect(hpOf(first, 4)).toBe(FULL);
    expect(healthBars(first, content).map((b) => b.id)).toEqual([3]);
    // Once every `cooldownTicks`.
    expect(hpOf(run(first, cooldownTicks - 1), 3)).toBe(FULL - damage);
    expect(hpOf(run(first, cooldownTicks), 3)).toBe(FULL - 2 * damage);
    // Until it's dead; the one out of range is never hit.
    const later = run(first, 10 * cooldownTicks);
    expect(later.components.gloamling[3]).toBeUndefined();
    expect(hpOf(later, 4)).toBe(FULL);
  });

  it('shoots the nearest first, ties to the lowest ID', () => {
    const nearer = run(
      towerAtNight([
        { x: 11, y: 4 },
        { x: 9, y: 4 },
      ]),
      1,
    );
    expect([hpOf(nearer, 3), hpOf(nearer, 4)]).toEqual([FULL, FULL - damage]);
    const tied = run(
      towerAtNight([
        { x: 9, y: 2 },
        { x: 3, y: 6 },
      ]),
      1,
    );
    expect([hpOf(tied, 3), hpOf(tied, 4)]).toEqual([FULL - damage, FULL]);
  });

  it('does nothing while its Watchman is out of it', () => {
    const away = towerAtNight([{ x: 8, y: 4 }], false);
    away.components.position[2] = tileCenter({ x: 1, y: 1 });
    expect(hpOf(run(away, 1), 3)).toBe(FULL);
  });

  it('does nothing unstaffed', () => {
    const unstaffed = towerAtNight([{ x: 8, y: 4 }]);
    destroyEntity(unstaffed, 2);
    expect(hpOf(run(unstaffed, 3 * cooldownTicks), 3)).toBe(FULL);
  });

  it('carries on from a save made between shots', () => {
    const s = run(towerAtNight([{ x: 9, y: 4 }]), 10);
    const loaded = deserialize(serialize(s), content);
    expect(run(loaded, 100)).toEqual(run(s, 100));
  });

  it("can't be attacked, and nor can its Watchman in it", () => {
    const s = run(towerAtNight([{ x: 7, y: 6 }]), 5 * cooldownTicks);
    expect(s.components.building[1]?.hp).toBeNull();
    expect(s.components.villager[2]?.hp).toBe(content.combat.villager.hp);
  });
});
