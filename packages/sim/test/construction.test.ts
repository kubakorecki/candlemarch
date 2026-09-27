import { describe, expect, it } from 'vitest';
import { dawnTick, duskTick } from '../src/calendar';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run } from './helpers';

/** A hut site on a bare yard, nobody to haul or build. */
const yard: MapDef = {
  name: 'yard',
  rows: ['....', '....', '....'],
  buildings: [],
  sites: [{ type: 'hut', x: 1, y: 0 }],
  villagers: [],
};

const buildTicks = content.buildings.hut.construction?.buildTicks ?? 0;

/** The yard at `tick`, with every material of its hut site delivered. */
function suppliedAt(tick: number): GameState {
  const s = createInitialState(1, yard, content);
  s.tick = tick;
  for (const id of idsOf(s.components.site)) {
    const site = s.components.site[id];
    if (site) site.delivered = { logs: 10 };
  }
  return s;
}

function siteProgress(s: GameState): number | undefined {
  return Object.values(s.components.site)[0]?.buildProgress;
}

function hasHut(s: GameState): boolean {
  return Object.values(s.components.building).some((b) => b.type === 'hut');
}

describe('construction', () => {
  it('builds for buildTicks once every material is in', () => {
    const s = suppliedAt(0);
    expect(hasHut(run(s, buildTicks - 1))).toBe(false);
    expect(hasHut(run(s, buildTicks))).toBe(true);
  });

  it('only builds by day: materials in late in the day finish the next morning', () => {
    const dusk = duskTick(1, content);
    const dawn = dawnTick(2, content);
    // 50 ticks of work before Dusk; the rest waits for Dawn.
    const s = suppliedAt(dusk - 50);

    const atDusk = run(s, 50);
    expect(siteProgress(atDusk)).toBe(50);
    const atDawn = run(atDusk, dawn - dusk);
    expect(hasHut(atDawn)).toBe(false);
    expect(siteProgress(atDawn)).toBe(50);

    const done = run(atDawn, buildTicks - 50);
    expect(done.tick).toBe(dawn + buildTicks - 50);
    expect(hasHut(done)).toBe(true);
    expect(hasHut(run(atDawn, buildTicks - 51))).toBe(false);
  });

  it('saved and loaded mid-night, finishes exactly as an uninterrupted run', () => {
    const dusk = duskTick(1, content);
    const s = suppliedAt(dusk - 50);
    const total = dawnTick(2, content) - s.tick + buildTicks;
    const midnight = run(s, 50 + 600);
    const loaded = deserialize(serialize(midnight), content);
    expect(run(loaded, total - 650)).toEqual(run(s, total));
  });
});
