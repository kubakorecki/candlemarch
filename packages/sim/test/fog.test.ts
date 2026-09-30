// Fog (spec, World and map; ADR-0005): which tiles the player has seen (Revealed) and sees now
// (In sight). It only decides where the player may build; the world acts as if it weren't there.
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { destroyEntity, idsOf } from '../src/entities';
import { isInSight, isRevealed } from '../src/fog';
import { canPlaceBuilding } from '../src/grid';
import { heroOrderAt } from '../src/hero';
import { createInitialState, type MapDef } from '../src/map';
import { canLayPath } from '../src/roads';
import { deserialize, serialize } from '../src/save';
import type { GameState, Tile } from '../src/state';
import { stepInPlace } from '../src/step';
import { canPlaceStockpile } from '../src/stockpiles';
import { content } from './helpers';

const DAY = 100;
const NIGHT = duskTick(1, content) + 100;

/** 60×30 grass with nothing on it but what `map` adds. */
function moor(map: Partial<MapDef> = {}): MapDef {
  return {
    name: 'moor',
    rows: Array.from({ length: 30 }, () => '.'.repeat(60)),
    buildings: [],
    villagers: [],
    ...map,
  };
}

/** A new game on `map` with Fog on, jumped to `tick` and run for one tick. */
function fogged(map: MapDef, tick = DAY): GameState {
  const s = createInitialState(1, map, content, 100, true);
  s.tick = tick;
  stepInPlace(s, [], content);
  return s;
}

/** Runs `s` in place for `ticks` ticks, `commandsAt[t]` on the tick starting at `t`. */
function play(s: GameState, ticks: number, commandsAt: Record<number, Command[]> = {}): GameState {
  for (let i = 0; i < ticks; i++) stepInPlace(s, commandsAt[s.tick] ?? [], content);
  return s;
}

/** Runs `s` in place until the Hero stands still. */
function heroArrives(s: GameState): GameState {
  const [hero] = idsOf(s.components.hero);
  for (let i = 0; i < 2000 && hero !== undefined && s.components.path[hero]; i++) play(s, 1);
  return s;
}

function moveHero(x: number, y: number): Command {
  return { type: 'orderHero', order: 'move', x, y };
}

/** How many tiles east of `from` are In sight in a row, `from` itself not counted. */
function sightEast(s: GameState, from: Tile): number {
  let d = 0;
  while (isInSight(s, { x: from.x + d + 1, y: from.y })) d += 1;
  return d;
}

describe('sight', () => {
  it('reaches 8 tiles round the Hero by day and 4 at night', () => {
    const map = moor({ hero: { x: 30, y: 15 } });
    expect(sightEast(fogged(map, DAY), { x: 30, y: 15 })).toBe(8);
    expect(sightEast(fogged(map, NIGHT), { x: 30, y: 15 })).toBe(4);
  });

  it('reaches 4 tiles round a villager by day and 2 at night', () => {
    const map = moor({ villagers: [{ job: 'carrier', x: 30, y: 15 }] });
    expect(sightEast(fogged(map, DAY), { x: 30, y: 15 })).toBe(4);
    expect(sightEast(fogged(map, NIGHT), { x: 30, y: 15 })).toBe(2);
  });

  it('reaches 3 tiles round a finished building by day and 1 at night', () => {
    const map = moor({ buildings: [{ type: 'hut', x: 30, y: 15 }] });
    expect(sightEast(fogged(map, DAY), { x: 30, y: 15 })).toBe(3);
    expect(sightEast(fogged(map, NIGHT), { x: 30, y: 15 })).toBe(1);
  });

  it("doesn't reach round a construction site", () => {
    const map = moor({ sites: [{ type: 'hut', x: 30, y: 15 }] });
    expect(isInSight(fogged(map, DAY), { x: 31, y: 15 })).toBe(false);
  });

  it('reaches 8 tiles round a watchtower with its Watchman, by day and at night', () => {
    // The Watchman comes out at the door, (30,16), and sees no further than 4 tiles itself.
    const map = moor({ buildings: [{ type: 'watchtower', x: 30, y: 15 }] });
    expect(sightEast(fogged(map, DAY), { x: 30, y: 15 })).toBe(8);
    expect(sightEast(fogged(map, NIGHT), { x: 30, y: 15 })).toBe(8);
  });

  it('reaches round a watchtower without its Watchman like any building', () => {
    const map = moor({ buildings: [{ type: 'watchtower', x: 30, y: 15 }] });
    const s = createInitialState(1, map, content, 100, true);
    destroyEntity(s, 2); // the Watchman
    s.tick = DAY;
    expect(sightEast(play(s, 1), { x: 30, y: 15 })).toBe(3);
  });

  it("reaches a lit light's lit tiles at night", () => {
    // A brazier lights 4 tiles round it once it burns its fuel at Dusk.
    const lit = moor({
      buildings: [{ type: 'brazier', x: 30, y: 15, stock: [{ resource: 'firewood', amount: 6 }] }],
    });
    expect(sightEast(fogged(lit, duskTick(1, content)), { x: 30, y: 15 })).toBe(4);
    const dark = moor({ buildings: [{ type: 'brazier', x: 30, y: 15 }] });
    expect(sightEast(fogged(dark, duskTick(1, content)), { x: 30, y: 15 })).toBe(1);
  });
});

describe('Revealed tiles', () => {
  it('start within 12 tiles of the Camp, plus the entry', () => {
    const s = fogged(
      moor({ villagers: [{ job: 'carrier', x: 10, y: 10 }], entry: { x: 59, y: 20 } }),
    );
    expect(isRevealed(s, { x: 22, y: 10 })).toBe(true);
    expect(isRevealed(s, { x: 23, y: 10 })).toBe(false);
    expect(isRevealed(s, { x: 10, y: 22 })).toBe(true);
    expect(isRevealed(s, { x: 10, y: 23 })).toBe(false);
    expect(isRevealed(s, { x: 59, y: 20 })).toBe(true);
    expect(isRevealed(s, { x: 58, y: 20 })).toBe(false);
  });

  it('stay Revealed once out of sight', () => {
    // The Camp (the Hero) Reveals x 0–22; the Hero sees (30,15) on its way east.
    const s = fogged(moor({ hero: { x: 10, y: 15 } }));
    expect(isRevealed(s, { x: 30, y: 15 })).toBe(false);
    heroArrives(play(s, 1, { [s.tick]: [moveHero(50, 15)] }));
    expect(isInSight(s, { x: 30, y: 15 })).toBe(false);
    expect(isRevealed(s, { x: 30, y: 15 })).toBe(true);
    expect(isRevealed(s, { x: 58, y: 15 })).toBe(true);
    // Rows the Hero never saw stay unrevealed.
    expect(isRevealed(s, { x: 30, y: 5 })).toBe(false);
  });
});

describe('building under Fog', () => {
  const map = moor({ hero: { x: 10, y: 10 } });

  it('is refused on an unrevealed tile: buildings, walls, Roads and Stockpiles', () => {
    const s = fogged(map);
    expect(canPlaceBuilding(s, content, 'hut', 40, 10)).toBe(false);
    expect(canPlaceBuilding(s, content, 'palisade', 40, 10)).toBe(false);
    expect(canLayPath(s, content, { x: 20, y: 12 }, { x: 30, y: 12 })).toBe(false);
    expect(canPlaceStockpile(s, content, 40, 10, 2, 2)).toBe(false);
    play(s, 1, { [s.tick]: [{ type: 'placeBuilding', building: 'hut', x: 40, y: 10 }] });
    expect(idsOf(s.components.site)).toEqual([]);
  });

  it('is allowed once the tile is Revealed', () => {
    const s = heroArrives(play(fogged(map), 1, { [DAY + 1]: [moveHero(40, 12)] }));
    expect(canPlaceBuilding(s, content, 'hut', 40, 10)).toBe(true);
    expect(canLayPath(s, content, { x: 20, y: 12 }, { x: 30, y: 12 })).toBe(true);
    expect(canPlaceStockpile(s, content, 40, 10, 2, 2)).toBe(true);
    play(s, 1, { [s.tick]: [{ type: 'placeBuilding', building: 'hut', x: 40, y: 10 }] });
    expect(idsOf(s.components.site).length).toBe(1);
  });

  it("doesn't stop the Hero walking into Fog", () => {
    const s = heroArrives(play(fogged(map), 1, { [DAY + 1]: [moveHero(59, 29)] }));
    const [hero] = idsOf(s.components.hero);
    expect(s.components.position[hero as number]).toEqual({ x: 59_500, y: 29_500 });
  });
});

describe('ordering the Hero under Fog', () => {
  it('walks it onto an unrevealed tile, whatever stands there unseen', () => {
    // A Den at (40,10) and a tree at (40,12), both far outside the Revealed Camp (x 0–22).
    const rows = Array.from({ length: 30 }, () => '.'.repeat(60));
    rows[10] = `${'.'.repeat(40)}D${'.'.repeat(19)}`;
    rows[12] = `${'.'.repeat(40)}T${'.'.repeat(19)}`;
    const s = fogged(moor({ rows, hero: { x: 10, y: 10 } }));
    expect(heroOrderAt(s, content, { x: 40, y: 10 })).toEqual({ order: 'move', x: 40, y: 10 });
    expect(heroOrderAt(s, content, { x: 40, y: 12 })).toEqual({ order: 'move', x: 40, y: 12 });
  });

  it('passes over a Gloamling that is out of sight', () => {
    // The Den at (20,10) is Revealed with the Camp; at night the Hero sees 4 tiles, not 10.
    const rows = Array.from({ length: 30 }, () => '.'.repeat(60));
    rows[10] = `${'.'.repeat(20)}D${'.'.repeat(39)}`;
    const s = fogged(moor({ rows, hero: { x: 10, y: 10 } }), duskTick(1, content));
    const [den] = idsOf(s.components.den);
    expect(idsOf(s.components.gloamling).length).toBeGreaterThan(0);
    expect(isInSight(s, { x: 20, y: 10 })).toBe(false);
    expect(heroOrderAt(s, content, { x: 20, y: 10 })).toEqual({ order: 'attackDen', den });
  });
});

describe('Fog off', () => {
  it('makes every tile Revealed and In sight', () => {
    const s = play(createInitialState(1, moor({ hero: { x: 10, y: 10 } }), content), 1);
    for (const t of [
      { x: 0, y: 0 },
      { x: 59, y: 29 },
      { x: 40, y: 10 },
    ]) {
      expect(isRevealed(s, t)).toBe(true);
      expect(isInSight(s, t)).toBe(true);
    }
    expect(canPlaceBuilding(s, content, 'hut', 50, 20)).toBe(true);
  });

  it('keeps what was Revealed when Fog is switched back on', () => {
    const s = fogged(moor({ hero: { x: 10, y: 15 } }));
    heroArrives(play(s, 1, { [s.tick]: [moveHero(30, 15)] }));
    play(s, 1, { [s.tick]: [{ type: 'setFog', on: false }] });
    expect(isInSight(s, { x: 59, y: 29 })).toBe(true);
    heroArrives(play(s, 1, { [s.tick]: [moveHero(50, 15)] }));
    play(s, 1, { [s.tick]: [{ type: 'setFog', on: true }] });
    expect(isRevealed(s, { x: 30, y: 15 })).toBe(true);
    expect(isInSight(s, { x: 30, y: 15 })).toBe(false);
    expect(isInSight(s, { x: 58, y: 15 })).toBe(true);
    expect(isRevealed(s, { x: 58, y: 15 })).toBe(true);
    expect(isRevealed(s, { x: 30, y: 5 })).toBe(false);
  });
});

describe('saving under Fog', () => {
  it('keeps the Revealed tiles, and a loaded game carries on as if never saved', () => {
    const map = moor({ hero: { x: 10, y: 15 }, villagers: [{ job: 'carrier', x: 12, y: 12 }] });
    const commands = { [DAY + 1]: [moveHero(50, 15)] };
    const whole = play(fogged(map), 400, commands);
    const half = play(fogged(map), 200, commands);
    const loaded = deserialize(serialize(half), content);
    expect(loaded.map.revealed).toEqual(half.map.revealed);
    expect(loaded.fog).toBe(true);
    expect(play(loaded, 200, commands)).toEqual(whole);
  });

  it('loads a save from before Fog with Fog off and every tile Revealed', () => {
    const s = fogged(moor({ hero: { x: 10, y: 15 } }));
    const old = JSON.parse(serialize(s));
    delete old.fog;
    delete old.map.revealed;
    delete old.map.inSight;
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.fog).toBe(false);
    expect(loaded.map.inSight).toEqual([]);
    play(loaded, 1, { [loaded.tick]: [{ type: 'setFog', on: true }] });
    expect(isRevealed(loaded, { x: 59, y: 29 })).toBe(true);
  });
});
