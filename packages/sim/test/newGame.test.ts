import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { isRevealed } from '../src/fog';
import { campCentre, newGame } from '../src/newGame';
import { deserialize, serialize } from '../src/save';
import type { Tile } from '../src/state';
import { generateValley } from '../src/valley/generate';
import { content, run } from './helpers';

describe('a new game', () => {
  it('on a generated Valley is the same game for the same seed, and another for another', () => {
    const setup = { map: 'valley', seed: 7, monsterRate: 100, fog: true } as const;
    const a = newGame(setup, content);
    const b = newGame(setup, content);
    const other = newGame({ ...setup, seed: 8 }, content);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map.width).toBe(128);
    expect(other.map.terrain).not.toEqual(a.map.terrain);
  });
});

describe('the Camp centre (where the camera starts)', () => {
  it('is the middle of the Granary on a generated Valley', () => {
    const { camp } = generateValley(7, content);
    const state = newGame({ map: 'valley', seed: 7, monsterRate: 100, fog: true }, content);
    expect(campCentre(state, content)).toEqual({ x: camp.x + 1, y: camp.y + 1 });
  });

  it("is the map's middle on a map without a Granary", () => {
    const state = newGame({ map: 'meadow', seed: 1, monsterRate: 100, fog: false }, content);
    expect(campCentre(state, content)).toEqual({
      x: state.map.width / 2,
      y: state.map.height / 2,
    });
  });
});

describe('Fog in a new game', () => {
  it('hides all but the Camp when on, and hides nothing when off', () => {
    const setup = { map: 'valley', seed: 7, monsterRate: 100, fog: true } as const;
    const fogged = newGame(setup, content);
    const clear = newGame({ ...setup, fog: false }, content);
    const c = campCentre(fogged, content);
    const corner = { x: 0, y: 0 };
    expect(fogged.fog).toBe(true);
    expect(isRevealed(fogged, { x: c.x, y: c.y })).toBe(true);
    expect(isRevealed(fogged, corner)).toBe(false);
    expect(clear.fog).toBe(false);
    expect(isRevealed(clear, corner)).toBe(true);
  });

  it('survives a save and load mid-run on a generated Valley', () => {
    const start = newGame({ map: 'valley', seed: 7, monsterRate: 100, fog: true }, content);
    // The Hero walks out towards Ruins, Revealing tiles on the way.
    const ruins = idsOf(start.components.poi).find(
      (id) => start.components.poi[id]?.kind === 'ruins',
    );
    const poi = start.components.tile[ruins as number] as Tile;
    const walk = { 0: [{ type: 'orderHero', order: 'move', x: poi.x, y: poi.y } as const] };
    const whole = run(start, 200, walk);
    const loaded = deserialize(serialize(run(start, 100, walk)), content);
    expect(whole.map.revealed).not.toEqual(start.map.revealed);
    expect(run(loaded, 100)).toEqual(whole);
  });
});
