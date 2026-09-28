// Night combat: Gloamlings going for the nearest target, fights resolved hit by hit in ID order,
// deaths by Gloamling, HP back to full at Dawn.
import { describe, expect, it } from 'vitest';
import { workSpeedPercent } from '../src/aura';
import { dawnTick, duskTick } from '../src/calendar';
import { healthBars } from '../src/combat';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { tileCenter, tileOfPoint } from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState, Tile } from '../src/state';
import { walkTo } from '../src/systems/movement';
import { content, run, runUntil } from './helpers';

const WIDTH = 30;
const HEIGHT = 9;
const DEN = { x: 20, y: 4 };

/** Open grass with a Den at `DEN` (ID 1) and river on `river` tiles. */
function rows(river: Tile[] = []): string[] {
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      if (x === DEN.x && y === DEN.y) return 'D';
      return river.some((r) => r.x === x && r.y === y) ? '~' : '.';
    }).join(''),
  );
}

/**
 * A field at Dusk on spring day 1: its Den sends out one Gloamling on the first tick. Carriers
 * stand on `villagers` (IDs 2, 3... in order); with no Granary or House they sleep where they
 * stand, out in the open.
 */
function fieldAtDusk(villagers: Tile[], map: Partial<MapDef> = {}): GameState {
  const s = createInitialState(
    1,
    {
      name: 'field',
      rows: rows(),
      buildings: [],
      villagers: villagers.map((t) => ({ job: 'carrier', ...t })),
      ...map,
    },
    content,
  );
  s.tick = duskTick(1, content);
  return s;
}

function theGloamling(s: GameState): EntityId {
  const [g] = idsOf(s.components.gloamling);
  if (g === undefined) throw new Error('no Gloamling out');
  return g;
}

function targetOf(s: GameState): EntityId | null {
  return s.components.gloamling[theGloamling(s)]?.target ?? null;
}

describe('Gloamling targets', () => {
  it('go for the nearest villager by walking distance', () => {
    // (15,4) is 5 tiles off as the crow flies, but a river wall at x=17 (open only at the
    // bottom row) makes it a long walk; (27,4) is 7 tiles off in the open.
    const wall = Array.from({ length: HEIGHT - 1 }, (_, y) => ({ x: 17, y }));
    const s = run(
      fieldAtDusk(
        [
          { x: 15, y: 4 },
          { x: 27, y: 4 },
        ],
        { rows: rows(wall) },
      ),
      1,
    );
    expect(targetOf(s)).toBe(3);
  });

  it('break ties by the lowest ID', () => {
    const s = run(
      fieldAtDusk([
        { x: 26, y: 4 },
        { x: 14, y: 4 },
      ]),
      1,
    );
    expect(targetOf(s)).toBe(2);
  });
});

describe('Gloamling targets', () => {
  it('leave villagers asleep at Home alone and wait at their door', () => {
    // A Hut at (12,3) (ID 2), door (12,4), where its resident (ID 3) sleeps.
    const start = fieldAtDusk([{ x: 12, y: 4 }], { buildings: [{ type: 'hut', x: 12, y: 3 }] });
    const s = run(start, 1);
    expect(s.components.villager[3]?.routine).toBe('asleep');
    expect(targetOf(s)).toBe(2);
    const later = run(s, 300);
    const g = theGloamling(later);
    expect(tileOfPoint(later.components.position[g] as { x: number; y: number })).toEqual({
      x: 12,
      y: 4,
    });
    expect(later.components.path[g]).toBeUndefined();
    expect(later.components.villager[3]?.hp).toBe(20);
  });

  it('go for the Hero when it is nearest', () => {
    const s = run(fieldAtDusk([{ x: 10, y: 4 }], { hero: { x: 24, y: 4 } }), 1);
    expect(targetOf(s)).toBe(idsOf(s.components.hero)[0]);
  });

  it('pick again when their target dies', () => {
    // Villager 2 is nearest and falls; villager 3 is next.
    const s = runUntil(
      run(
        fieldAtDusk([
          { x: 17, y: 4 },
          { x: 12, y: 4 },
        ]),
        1,
      ),
      (x) => x.components.villager[2] === undefined,
      1000,
    );
    expect(s.components.villager[2]).toBeUndefined();
    expect(targetOf(run(s, 1))).toBe(3);
  });
});

/** One carrier (ID 2) at (17,4), three tiles from the Den, fighting its Gloamling (ID 3). */
function duel(): GameState {
  return fieldAtDusk([{ x: 17, y: 4 }]);
}

describe('fights', () => {
  it('resolve the same way every run: the Gloamling wins one on one', () => {
    const a = run(duel(), 400);
    const b = run(duel(), 400);
    expect(a).toEqual(b);
    // Hits land in ID order: the villager (ID 2) strikes first each round, so it lands 5 hits
    // of 3 before the Gloamling's 5th hit of 4 kills it.
    expect(a.components.villager[2]).toBeUndefined();
    expect(a.components.gloamling[3]?.hp).toBe(20 - 5 * 3);
  });

  it('take 20 ticks between hits', () => {
    const engaged = runUntil(
      run(duel(), 1),
      (x) => x.components.villager[2]?.fighting === true,
      400,
    );
    expect(engaged.components.villager[2]?.fighting).toBe(true);
    expect(engaged.components.villager[2]?.hp).toBe(16);
    expect(engaged.components.gloamling[3]?.hp).toBe(17);
    const hp = (s: GameState) => [s.components.villager[2]?.hp, s.components.gloamling[3]?.hp];
    expect(hp(run(engaged, 19))).toEqual([16, 17]);
    expect(hp(run(engaged, 20))).toEqual([12, 14]);
  });

  it('record a death by Gloamling, and game over for the last villager', () => {
    const s = run(duel(), 400);
    const name = duel().components.villager[2]?.name;
    expect(s.deaths).toEqual([{ name, cause: 'gloamling', day: 1 }]);
    expect(s.gameOver).toEqual({ day: 1, cause: 'gloamling' });
  });

  it('end when the villager kills its Gloamling, and HP is full again at Dawn', () => {
    const start = run(duel(), 1);
    (start.components.gloamling[3] as { hp: number }).hp = 6;
    // Two hits of 3 kill it; it lands one hit of 4 in between.
    const s = run(start, 200);
    expect(s.components.gloamling[3]).toBeUndefined();
    expect(s.components.villager[2]).toMatchObject({ hp: 16, fighting: false });
    const dawn = dawnTick(2, content);
    const morning = run(s, dawn + 1 - s.tick);
    expect(morning.components.villager[2]?.hp).toBe(20);
  });

  it('load saves made before combat with full HP and no targets', () => {
    const s = run(duel(), 1);
    const old = JSON.parse(serialize(s));
    for (const key of ['hp', 'readyAt', 'fighting']) delete old.components.villager[2][key];
    for (const key of ['hp', 'readyAt', 'target']) delete old.components.gloamling[3][key];
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.components.villager[2]).toMatchObject({ hp: 20, readyAt: 0, fighting: false });
    expect(loaded.components.gloamling[3]).toMatchObject({ hp: 20, readyAt: 0, target: null });
  });

  it('carry on mid-fight from a save', () => {
    const mid = run(
      runUntil(duel(), (x) => x.components.villager[2]?.fighting === true, 400),
      10,
    );
    expect(mid.components.villager[2]?.fighting).toBe(true);
    const loaded = deserialize(serialize(mid), content);
    expect(run(loaded, 200)).toEqual(run(mid, 200));
  });
});

describe('a villager a Gloamling reaches', () => {
  // A Granary with meat east of the Den (ID 2, door (28,5)); a carrier (ID 3) at (10,4) walks
  // there past the Den for its Meal. Its Gloamling (ID 4) is left one hit from death.
  function mealWalk(): GameState {
    const s = run(
      fieldAtDusk([{ x: 10, y: 4 }], {
        buildings: [{ type: 'granary', x: 27, y: 3, stock: [{ resource: 'meat', amount: 20 }] }],
      }),
      1,
    );
    (s.components.gloamling[4] as { hp: number }).hp = 3;
    return s;
  }

  it('stops, fights back, then carries on with its routine', () => {
    const s = mealWalk();
    expect(s.components.villager[3]?.routine).toBe('toGranary');
    const fight = runUntil(s, (x) => x.components.villager[3]?.fighting === true, 400);
    // It stops at the next tile and kills the Gloamling with its first hit.
    expect(fight.components.villager[3]?.fighting).toBe(true);
    const path = fight.components.path[3];
    expect(path === undefined || path.tiles.length === path.next + 1).toBe(true);
    expect(fight.components.gloamling[4]).toBeUndefined();
    const fed = runUntil(fight, (x) => x.components.villager[3]?.routine === 'asleep', 1000);
    expect(fed.components.villager[3]).toMatchObject({ missedMeals: 0, fighting: false });
    expect(fed.components.building[2]?.stock.meat).toBe(19);
  });

  it('drops its work in hand by the unassign rule', () => {
    // The hut (ID 2, door (28,5)) comes with its woodcutter (ID 3), here carrying a log home
    // from (10,4), past the Den.
    const start = fieldAtDusk([], { buildings: [{ type: 'woodcutters_hut', x: 27, y: 3 }] });
    start.tick -= 1;
    start.components.position[3] = tileCenter({ x: 10, y: 4 });
    const v = start.components.villager[3];
    if (!v) throw new Error('no woodcutter');
    v.carrying = { resource: 'logs', amount: 1 };
    start.components.woodcutter[3] = { kind: 'toHut' };
    walkTo(start, content, 3, [{ x: 28, y: 5 }]);
    const s = run(start, 2);
    (s.components.gloamling[4] as { hp: number }).hp = 3;
    const fight = runUntil(s, (x) => x.components.villager[3]?.fighting === true, 400);
    // Caught on the way, well short of the hut.
    expect(fight.components.villager[3]).toMatchObject({ fighting: true, carrying: null });
    expect((fight.components.position[3]?.x ?? 0) < 26000).toBe(true);
    expect(fight.components.villager[3]).toMatchObject({ job: 'woodcutter', workplace: 2 });
    expect(fight.components.woodcutter[3]).toEqual({ kind: 'idle', retryAt: 0 });
    expect(fight.components.building[2]?.stock.logs).toBe(1);
  });
});

describe('the Hero', () => {
  /** The Hero (ID 2) at (17,4), three tiles from the Den; its Gloamling is ID 3. */
  function heroField(): GameState {
    return fieldAtDusk([], { hero: { x: 17, y: 4 } });
  }

  it('kills a Gloamling that reaches it', () => {
    const s = runUntil(run(heroField(), 1), (x) => x.components.gloamling[3] === undefined, 400);
    expect(s.components.gloamling[3]).toBeUndefined();
    // Two hits of 10. The Hero (lower ID) strikes first each round, so the Gloamling lands one
    // hit of 4.
    expect(s.components.hero[2]?.hp).toBe(96);
  });

  /**
   * A villager (ID 2) at (6,4) and the Hero (ID 3) at (17,4); the Gloamling (ID 4) goes for the
   * Hero, which is 4 HP from a knockout, and can't be killed.
   */
  function knockout(): GameState {
    const s = run(fieldAtDusk([{ x: 6, y: 4 }], { hero: { x: 17, y: 4 } }), 1);
    (s.components.hero[3] as { hp: number }).hp = 4;
    (s.components.gloamling[4] as { hp: number }).hp = 1000;
    return s;
  }

  it('is Knocked out at 0 HP, and its Gloamling goes for someone else', () => {
    const s = knockout();
    expect(targetOf(s)).toBe(3);
    const out = runUntil(s, (x) => x.components.hero[3]?.knockedOutUntil !== null, 400);
    expect(out.components.hero[3]).toMatchObject({ hp: 0, knockedOutUntil: out.tick - 1 + 400 });
    expect(targetOf(run(out, 1))).toBe(2);
  });

  it('gets up at full HP 400 ticks later', () => {
    const out = runUntil(knockout(), (x) => x.components.hero[3]?.knockedOutUntil !== null, 400);
    const until = out.components.hero[3]?.knockedOutUntil as number;
    const still = run(out, until - out.tick);
    expect(still.components.hero[3]).toMatchObject({ hp: 0, knockedOutUntil: until });
    expect(run(still, 1).components.hero[3]).toMatchObject({ hp: 100, knockedOutUntil: null });
  });

  it('takes no orders while Knocked out', () => {
    const out = runUntil(knockout(), (x) => x.components.hero[3]?.knockedOutUntil !== null, 400);
    const settled = run(out, 30); // it finishes the step it fell on
    const at = settled.components.position[3];
    const s = run(settled, 30, {
      [settled.tick]: [{ type: 'orderHero', order: 'move', x: 17, y: 0 }],
    });
    expect(s.components.path[3]).toBeUndefined();
    expect(s.components.position[3]).toEqual(at);
    expect(heroOrderAt(s, content, { x: 17, y: 0 })).toBeNull();
  });

  it('has no aura while Knocked out', () => {
    // A woodcutter's hut (ID 2) at (10,3) with its woodcutter (ID 3); the Hero (ID 4) beside it.
    const s = fieldAtDusk([], {
      buildings: [{ type: 'woodcutters_hut', x: 10, y: 3 }],
      hero: { x: 12, y: 4 },
    });
    expect(workSpeedPercent(s, content, 2)).toBe(125);
    (s.components.hero[4] as { knockedOutUntil: number | null }).knockedOutUntil = s.tick + 400;
    expect(workSpeedPercent(s, content, 2)).toBe(100);
  });

  // The Hero (ID 2) at (5,4), out of the Gloamling's sight (ID 3), which waits at its Den with
  // nothing to go for.
  function outOfSight(): GameState {
    return run(fieldAtDusk([], { hero: { x: 5, y: 4 } }), 1);
  }

  it('is ordered to attack by right-clicking a Gloamling', () => {
    const s = outOfSight();
    expect(targetOf(s)).toBeNull();
    expect(heroOrderAt(s, content, DEN)).toEqual({ order: 'attack', gloamling: 3 });
  });

  it('walks to a Gloamling it is ordered to attack and kills it', () => {
    const s = outOfSight();
    const idle = run(s, 200);
    expect(idle.components.gloamling[3]).toBeDefined();
    expect(idle.components.position[2]).toEqual(s.components.position[2]);
    const attack: Command = { type: 'orderHero', order: 'attack', gloamling: 3 };
    const done = runUntil(s, (x) => x.components.gloamling[3] === undefined, 400, {
      [s.tick]: [attack],
    });
    expect(done.components.gloamling[3]).toBeUndefined();
    expect(done.components.hero[2]?.order).toBeNull();
  });

  it('carries on from a save made while Knocked out', () => {
    const out = run(
      runUntil(knockout(), (x) => x.components.hero[3]?.knockedOutUntil !== null, 400),
      50,
    );
    expect(out.components.hero[3]?.knockedOutUntil).not.toBeNull();
    const loaded = deserialize(serialize(out), content);
    expect(run(loaded, 400)).toEqual(run(out, 400));
  });

  it('loads saves made before it could fight with full HP, up and ready', () => {
    const old = JSON.parse(serialize(fieldAtDusk([], { hero: { x: 5, y: 4 } })));
    for (const key of ['hp', 'readyAt', 'knockedOutUntil']) delete old.components.hero[2][key];
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.components.hero[2]).toMatchObject({ hp: 100, readyAt: 0, knockedOutUntil: null });
  });

  it('shows a health bar while a Gloamling is in its reach', () => {
    const s = run(heroField(), 1);
    expect(healthBars(s, content).some((b) => b.id === 2)).toBe(false);
    const fight = runUntil(s, (x) => x.components.hero[2]?.hp !== 100, 400);
    expect(healthBars(fight, content)).toContainEqual({ id: 2, hp: 96, maxHp: 100 });
  });
});
