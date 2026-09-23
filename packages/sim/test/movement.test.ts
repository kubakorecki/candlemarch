import { describe, expect, it } from 'vitest';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState } from '../src/state';
import { movementSystem, walkTo } from '../src/systems/movement';
import { content } from './helpers';

const strip: MapDef = {
  name: 'strip',
  rows: ['............', '............'],
  buildings: [],
  villagers: [{ role: 'carrier', x: 0, y: 0 }],
};

function walk(s: GameState, id: number): number {
  let ticks = 0;
  while (s.components.path[id]) {
    movementSystem(s, content);
    ticks += 1;
    const p = s.components.position[id];
    expect(Number.isInteger(p?.x) && Number.isInteger(p?.y)).toBe(true);
  }
  return ticks;
}

describe('movement', () => {
  it('walks at the role speed and ends exactly on the tile centre', () => {
    const s = createInitialState(1, strip, content);
    const id = 1;
    expect(walkTo(s, content, id, [{ x: 10, y: 0 }])).toBe(true);
    const ticks = walk(s, id);
    // 10 tiles × 1000 units at 75 units per tick.
    expect(ticks).toBe(Math.ceil(10_000 / content.villagerRoles.carrier.walkSpeed));
    expect(s.components.position[id]).toEqual({ x: 10_500, y: 500 });
  });

  it('diagonal steps cost 1414 units', () => {
    const s = createInitialState(1, strip, content);
    const id = 1;
    walkTo(s, content, id, [{ x: 1, y: 1 }]);
    expect(walk(s, id)).toBe(Math.ceil(1414 / content.villagerRoles.carrier.walkSpeed));
    expect(s.components.position[id]).toEqual({ x: 1500, y: 1500 });
  });

  it('refuses unreachable goals without changing state', () => {
    const s = createInitialState(1, strip, content);
    const before = JSON.stringify(s);
    expect(walkTo(s, content, 1, [{ x: 99, y: 0 }])).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
});
