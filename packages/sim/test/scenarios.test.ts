// The logistics scenario maps: logs flow from woodcutters to the stockpile (and the site) under
// both logistics models.
import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { unstaffedSegments } from '../src/logistics/flagRelay';
import type { LogisticsModelId } from '../src/logistics/model';
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
 * Tick limits are about 1.5× the slower model's measured time to meet the goal (seed 1):
 * short haul A 841, B 834; long haul A 1270, B 1471; branching network A 1339 (site built at
 * 1186), B 1992 (site at 1695). The woodcutters are the bottleneck, at about 80 ticks per log.
 */
const scenarios: { map: MapDef; limit: number }[] = [
  { map: maps.shortHaul, limit: 1300 },
  { map: maps.longHaul, limit: 2300 },
  { map: maps.branchingNetwork, limit: 3000 },
];
const models: LogisticsModelId[] = ['jobDispatch', 'flagRelay'];

describe.each(scenarios)('$map.name', ({ map, limit }) => {
  it.each(models)(
    `gets logs to the stockpile and its sites within ${limit} ticks under %s`,
    (model) => {
      const start = createInitialState(1, map, content, model);
      const done = (s: GameState) => stockpileLogs(s) >= PILE_LOGS && sitesBuilt(start, s);
      const end = runUntil(start, done, limit);
      expect(stockpileLogs(end)).toBeGreaterThanOrEqual(PILE_LOGS);
      expect(sitesBuilt(start, end)).toBe(true);
      // The map's fixed Carrier count staffs its whole road network.
      expect(unstaffedSegments(end)).toEqual([]);
    },
  );
});

describe.each(models)('branching network under %s', (model) => {
  // At 1200 logs are moving under both models: job dispatch has just built the site, flag relay
  // is still supplying it.
  it('saved and loaded mid-run, continues like an uninterrupted run', () => {
    const fresh = () => createInitialState(1, maps.branchingNetwork, content, model);
    const uninterrupted = run(fresh(), 2500);
    const midway = run(fresh(), 1200);
    const loaded = deserialize(serialize(midway));
    expect(loaded.logistics.model).toBe(model);
    expect(run(loaded, 1300)).toEqual(uninterrupted);
  });
});
