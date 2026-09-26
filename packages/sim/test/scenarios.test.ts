// The logistics scenario maps: logs flow from woodcutters to the stockpile (and the site).
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { maps } from '../src/maps';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/** Logs a steady flow has put on the stockpile, more than one lucky delivery. */
const PILE_LOGS = 5;

function stockpileLogs(s: GameState): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const goods of Object.values(pile.goods))
      if (goods.resource === 'logs') total += goods.amount;
  }
  return total;
}

/** Whether every site the game started with is now a building (a site keeps its ID). */
function sitesBuilt(start: GameState, s: GameState): boolean {
  return idsOf(start.components.site).every((id) => s.components.building[id] !== undefined);
}

/**
 * Tick limits are about 1.5× the measured time to meet the goal (seed 1): short haul 841, long
 * haul 1270, branching network 1339 (site built at 1186). The woodcutters are the bottleneck, at
 * about 80 ticks per log.
 */
const scenarios: { map: MapDef; limit: number }[] = [
  { map: maps.shortHaul, limit: 1300 },
  { map: maps.longHaul, limit: 1900 },
  { map: maps.branchingNetwork, limit: 2000 },
];

describe.each(scenarios)('$map.name', ({ map, limit }) => {
  it(`gets logs to the stockpile and its sites within ${limit} ticks`, () => {
    const start = createInitialState(1, map, content);
    const done = (s: GameState) => stockpileLogs(s) >= PILE_LOGS && sitesBuilt(start, s);
    const end = runUntil(start, done, limit);
    expect(stockpileLogs(end)).toBeGreaterThanOrEqual(PILE_LOGS);
    expect(sitesBuilt(start, end)).toBe(true);
  });
});

describe('branching network', () => {
  // At 1200 logs are moving: the site has just been built and the stockpile is filling.
  it('saved and loaded mid-run, continues like an uninterrupted run', () => {
    const fresh = () => createInitialState(1, maps.branchingNetwork, content);
    const uninterrupted = run(fresh(), 2500);
    const midway = run(fresh(), 1200);
    expect(run(deserialize(serialize(midway)), 1300)).toEqual(uninterrupted);
  });
});
