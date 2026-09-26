import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { tileOfPoint } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/** An open field with a hero at (1,1) and a tree at (6,1). */
const field: MapDef = {
  name: 'field',
  rows: ['..........', '......T...', '..........', '..........', '..........'],
  buildings: [],
  villagers: [],
  hero: { x: 1, y: 1 },
};
const { hero: _, ...fieldWithoutHero } = field;

function heroId(s: GameState): number {
  return idsOf(s.components.hero)[0] as number;
}

function heroTile(s: GameState) {
  const pos = s.components.position[heroId(s)];
  return pos ? tileOfPoint(pos) : null;
}

function move(x: number, y: number): Command {
  return { type: 'orderHero', order: 'move', x, y };
}

describe('hero', () => {
  it('spawns from the map at its tile centre', () => {
    const s = createInitialState(1, field, content);
    expect(idsOf(s.components.hero)).toHaveLength(1);
    const id = heroId(s);
    expect(s.components.hero[id]).toEqual({ type: 'placeholder', carrying: null, order: null });
    expect(s.components.position[id]).toEqual({ x: 1500, y: 1500 });
    expect(s.components.villager[id]).toBeUndefined();
  });

  it('a map without a hero has none', () => {
    const s = createInitialState(1, fieldWithoutHero, content);
    expect(idsOf(s.components.hero)).toHaveLength(0);
  });

  it('walks to the ordered tile at the hero walk speed', () => {
    const s0 = createInitialState(1, field, content);
    const end = runUntil(s0, (s) => s.tick > 0 && !s.components.path[heroId(s)], 500, {
      0: [move(5, 1)],
    });
    expect(end.components.position[heroId(end)]).toEqual({ x: 5500, y: 1500 });
    // 4 tiles east; the tick the order arrives on already moves the hero.
    expect(end.tick).toBe(Math.ceil(4000 / content.heroes.placeholder.walkSpeed));
  });

  it('walks around what blocks it', () => {
    const s0 = createInitialState(1, field, content);
    const end = runUntil(s0, (s) => s.tick > 0 && !s.components.path[heroId(s)], 500, {
      0: [move(9, 1)],
    });
    expect(end.components.position[heroId(end)]).toEqual({ x: 9500, y: 1500 });
  });

  it('a new order replaces the current one without snapping back', () => {
    const s0 = createInitialState(1, field, content);
    const midway = run(s0, 13, { 0: [move(9, 1)] });
    const before = midway.components.position[heroId(midway)];
    const turned = run(midway, 1, { [midway.tick]: [move(1, 4)] });
    const after = turned.components.position[heroId(turned)];
    // Keeps walking forward to the next tile centre instead of jumping back to the last one.
    expect(after?.x).toBeGreaterThan(before?.x ?? 0);

    const end = runUntil(turned, (s) => !s.components.path[heroId(s)], 500);
    expect(heroTile(end)).toEqual({ x: 1, y: 4 });
  });

  it('ignores an order to a tile it cannot reach', () => {
    const s0 = createInitialState(1, field, content);
    const walking = run(s0, 1, { 0: [move(9, 1)] });
    const s = run(walking, 1, { 1: [move(6, 1), move(40, 40)] });
    const path = s.components.path[heroId(s)];
    expect(path?.tiles.at(-1)).toBe(1 * 10 + 9);
  });

  it('is deterministic', () => {
    const orders: Record<number, Command[]> = {
      0: [move(9, 3)],
      25: [move(0, 0)],
      60: [move(5, 4)],
    };
    const a = run(createInitialState(4, field, content), 200, orders);
    const b = run(createInitialState(4, field, content), 200, orders);
    expect(a).toEqual(b);
  });

  it('save and load mid-walk continues exactly as an uninterrupted run', () => {
    const orders: Record<number, Command[]> = { 0: [move(9, 3)], 40: [move(0, 4)] };
    const s0 = createInitialState(4, field, content);
    const straight = run(s0, 150, orders);
    const saved = serialize(run(s0, 55, orders));
    const resumed = run(deserialize(saved), 95, orders);
    expect(resumed).toEqual(straight);
  });

  it('loads a save made before heroes existed', () => {
    const s = createInitialState(1, fieldWithoutHero, content);
    const data = JSON.parse(serialize(s));
    delete data.components.hero;
    expect(deserialize(JSON.stringify(data))).toEqual(s);
  });

  it('loads a save made before the hero could carry', () => {
    const s = createInitialState(1, field, content);
    const data = JSON.parse(serialize(s));
    const hero = data.components.hero[heroId(s)];
    delete hero.carrying;
    delete hero.order;
    expect(deserialize(JSON.stringify(data))).toEqual(s);
  });
});
