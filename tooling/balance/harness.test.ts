import { content } from '@candlemarch/content';
import { createInitialState, type MapDef } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { formatTable, measure, runScenario, type Scenario } from './harness';

/** Days of 200 ticks, so a few days run in well under a second. */
const shortDays = {
  ...content,
  calendar: {
    ...content.calendar,
    seasons: content.calendar.seasons.map((s) => ({ ...s, nightTicks: 50 })),
    dayTicks: 200,
  },
};

/** 8×6: four trees, a woodcutter's hut at (3,0) with its door at (4,2), one carrier. */
const tinyMap: MapDef = {
  name: 'tiny',
  rows: ['TT......', 'TT......', '........', '........', '........', '........'],
  buildings: [{ type: 'woodcutters_hut', x: 3, y: 0 }],
  villagers: [{ job: 'carrier', x: 4, y: 4 }],
};

const tiny: Scenario = {
  name: 'tiny',
  map: tinyMap,
  seed: 1,
  ticks: 450,
  commands: { 0: [{ type: 'placeStockpile', x: 5, y: 3, w: 2, h: 2 }] },
};

describe('balance harness', () => {
  it('reports at the start, at each Dawn and at the end', () => {
    const reports = runScenario(tiny, shortDays);
    expect(reports.map((r) => r.tick)).toEqual([0, 200, 400, 450]);
    expect(reports.map((r) => r.date)).toEqual([
      'Y1 Spring 1',
      'Y1 Spring 2',
      'Y1 Spring 3',
      'Y1 Spring 3',
    ]);
  });

  it('counts population, deaths and stored goods', () => {
    const reports = runScenario(tiny, shortDays);
    for (const r of reports) {
      expect(r.population).toBe(2);
      expect(r.deaths).toBe(0);
    }
    expect(reports[0]?.stock.logs).toBe(0);
    // Nothing uses logs here, so the stock only grows once the scripted stockpile takes them.
    const logs = reports.map((r) => r.stock.logs);
    expect(logs).toEqual([...logs].sort((a, b) => a - b));
    expect(reports.at(-1)?.stock.logs).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(runScenario(tiny, shortDays)).toEqual(runScenario(tiny, shortDays));
  });

  it('counts villagers seen earlier and gone now as deaths', () => {
    const state = createInitialState(1, tinyMap, content);
    const seen = new Set<number>();
    expect(measure(state, content, seen)).toMatchObject({ population: 2, deaths: 0 });
    const [first] = Object.keys(state.components.villager).map(Number);
    delete state.components.villager[first as number];
    expect(measure(state, content, seen)).toMatchObject({ population: 1, deaths: 1 });
  });

  it('formats a table with a column per resource', () => {
    const lines = formatTable(runScenario(tiny, shortDays), shortDays).split('\n');
    expect(lines).toHaveLength(2 + 4);
    expect(lines[0]).toMatch(/Tick\s+Date\s+Pop\s+Deaths\s+Logs\s+Firewood\s+Fish/);
    expect(lines[2]).toMatch(/^\s*0\s+Y1 Spring 1\s+2\s+0\s+0\s+0\s+0$/);
  });
});
