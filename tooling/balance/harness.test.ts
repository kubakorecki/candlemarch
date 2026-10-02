import { content } from '@candlemarch/content';
import { createInitialState, type MapDef, step, stepInPlace } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { formatTable, measure, runScenario, type Scenario } from './harness';
import { scenarios } from './scenarios';

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

  it("reports the Carriers' busy share of the last day", () => {
    const reports = runScenario(tiny, shortDays);
    expect(reports[0]?.carriersBusy).toBeNull();
    // The one Carrier hauls logs from the hut to the stockpile all day.
    expect(reports[1]?.carriersBusy).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(runScenario(tiny, shortDays)).toEqual(runScenario(tiny, shortDays));
  });

  it('steps in place exactly as step does, through two short days of the Camp', () => {
    const { map, seed, commands } = scenarios.camp;
    let copied = createInitialState(seed, map, shortDays);
    const inPlace = createInitialState(seed, map, shortDays);
    for (let i = 0; i <= 2 * shortDays.calendar.dayTicks; i++) {
      copied = step(copied, commands[copied.tick] ?? [], shortDays);
      stepInPlace(inPlace, commands[inPlace.tick] ?? [], shortDays);
    }
    expect(JSON.stringify(inPlace)).toBe(JSON.stringify(copied));
  });

  it('counts villagers seen earlier and gone now as deaths', () => {
    const state = createInitialState(1, tinyMap, content);
    const seen = new Set<number>();
    expect(measure(state, content, seen)).toMatchObject({ population: 2, deaths: 0 });
    const [first] = Object.keys(state.components.villager).map(Number);
    delete state.components.villager[first as number];
    expect(measure(state, content, seen)).toMatchObject({ population: 1, deaths: 1 });
  });

  it('counts deaths by cause, from the death record', () => {
    const state = createInitialState(1, tinyMap, content);
    const none = { starvation: 0, freezing: 0, gloamling: 0, den: 0 };
    expect(measure(state, content, new Set()).deathsBy).toEqual(none);
    state.deaths.push(
      { name: 'Ada', cause: 'gloamling', day: 1 },
      { name: 'Roger', cause: 'gloamling', day: 2 },
      { name: 'Alice', cause: 'den', day: 2 },
    );
    expect(measure(state, content, new Set()).deathsBy).toEqual({
      ...none,
      gloamling: 2,
      den: 1,
    });
  });

  it('counts the Food gatherers make between reports', () => {
    // A river along row 3 and a fisher's hut on its bank; the lone villager is staffed as the
    // fisher, so nobody hauls the catch away and all of it stays in the hut.
    const bank: Scenario = {
      name: 'bank',
      map: {
        name: 'bank',
        rows: ['........', '........', '........', '~~~~~~~~', '........'],
        buildings: [{ type: 'fishers_hut', x: 0, y: 1 }],
        villagers: [{ job: 'carrier', x: 0, y: 2 }],
      },
      seed: 1,
      ticks: 1000,
      commands: {},
    };
    const [start, end] = runScenario(bank, content);
    expect(start?.made).toEqual({
      fish: 0,
      berries: 0,
      mushrooms: 0,
      meat: 0,
      grain: 0,
      smoked_fish: 0,
      smoked_meat: 0,
    });
    expect(end?.made.fish).toBeGreaterThan(0);
    expect(end?.made.fish).toBe(end?.stock.fish);
  });

  it("throws when a scripted building doesn't place", () => {
    // (0,0) is a tree.
    const blocked: Scenario = {
      ...tiny,
      commands: { 5: [{ type: 'placeBuilding', building: 'hut', x: 0, y: 0 }] },
    };
    expect(() => runScenario(blocked, shortDays)).toThrow(
      "tiny: hut at (0, 0) on tick 5 didn't place",
    );
  });

  it('formats a table with a column per resource', () => {
    const lines = formatTable(runScenario(tiny, shortDays), shortDays).split('\n');
    expect(lines).toHaveLength(2 + 4);
    expect(lines[0]).toMatch(
      /Tick\s+Date\s+Pop\s+Deaths\s+Starved\s+Froze\s+Gloamling\s+Den\s+Busy\s+Logs\s+Firewood\s+Fish\s+Berries\s+Mushrooms\s+Meat\s+Hides\s+Stone\s+Clay\s+Iron ore\s+Grain\s+Charcoal\s+Planks\s+Cut stone\s+Bricks\s+Smoked fish\s+Smoked meat\s+Iron bars\s+Ale\s+Tools\s+\+Fish\s+\+Berries\s+\+Mushrooms\s+\+Meat\s+\+Grain\s+\+Smoked fish\s+\+Smoked meat$/,
    );
    // Nobody has died and no Carrier has worked yet at tick 0: "-" for Busy.
    expect(lines[2]).toMatch(/^\s*0\s+Y1 Spring 1\s+2\s+0\s+0\s+0\s+0\s+0\s+-(\s+0){27}$/);
  });
});
