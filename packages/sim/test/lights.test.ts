// Light sources the client draws a glow around. House windows glow at night while someone is in;
// they give no Light (ADR-0003), so nothing here changes what Gloamlings can do.
import { describe, expect, it } from 'vitest';
import { duskTick } from '../src/calendar';
import { tileCenter } from '../src/grid';
import { lightSources } from '../src/lights';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState } from '../src/state';
import { content } from './helpers';

/**
 * A Hut at (2,0) (door (2,1)), a woodcutter's hut at (6,0) and a Carrier at (4,3) who lives in
 * the Hut (set by hand; the Homes rule would on the first tick). IDs: Hut 1, woodcutter's hut 2,
 * Carrier 3.
 */
const camp: MapDef = {
  name: 'camp',
  rows: Array.from({ length: 6 }, () => '..........'),
  buildings: [
    { type: 'hut', x: 2, y: 0 },
    { type: 'woodcutters_hut', x: 6, y: 0 },
  ],
  villagers: [{ job: 'carrier', x: 4, y: 3 }],
};

const HUT = 1;
const CARRIER = 3;
const WINTER_DAY = 16;

/** The camp at `tick`, with the Carrier standing at its Home's door when `home`. */
function campAt(tick: number, home: boolean): GameState {
  const s = createInitialState(1, camp, content);
  s.tick = tick;
  const carrier = s.components.villager[CARRIER];
  if (carrier) carrier.home = HUT;
  if (home) s.components.position[CARRIER] = tileCenter({ x: 2, y: 1 });
  return s;
}

describe('light sources', () => {
  it('are none by day', () => {
    expect(lightSources(campAt(duskTick(1, content) - 1, true), content)).toEqual([]);
  });

  it("include a House's windows at night while a resident is at Home", () => {
    expect(lightSources(campAt(duskTick(1, content), true), content)).toEqual([
      { id: HUT, kind: 'window' },
    ]);
  });

  it('leave a House dark while nobody is in', () => {
    expect(lightSources(campAt(duskTick(1, content), false), content)).toEqual([]);
  });

  it('leave a cold House dark', () => {
    const s = campAt(duskTick(WINTER_DAY, content), true);
    const hut = s.components.building[HUT];
    if (hut) hut.cold = true;
    expect(lightSources(s, content)).toEqual([]);
  });
});
