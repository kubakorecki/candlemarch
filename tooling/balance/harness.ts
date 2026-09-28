// Headless balance runs: play a scripted scenario through the sim and report how the village
// fares, day by day. Imports sim and content only, like any other caller of `step`.
import type { Content, ResourceId } from '@candlemarch/content';
import {
  type Command,
  calendarAt,
  carrierUtilization,
  createInitialState,
  type EntityId,
  type GameState,
  idsOf,
  isDawn,
  type MapDef,
  stepInPlace,
} from '@candlemarch/sim';

export interface Scenario {
  name: string;
  map: MapDef;
  seed: number;
  /** How many ticks to run. */
  ticks: number;
  /** Commands applied on the tick that starts at that tick number, as the player would send them. */
  commands: Record<number, Command[]>;
}

/** How the village stands at one tick. */
export interface DayReport {
  tick: number;
  /** "Y1 Spring 2". */
  date: string;
  /** Villagers alive. The hero isn't one. */
  population: number;
  /** Villagers seen earlier in the run who are gone now. */
  deaths: number;
  /** Carrier utilization over the last in-game day (`carrierUtilization`), in %; null if no Carrier worked. */
  carriersBusy: number | null;
  /** Goods stored in stockpiles and building buffers. Goods in hands or on sites don't count. */
  stock: Record<ResourceId, number>;
}

/**
 * Measures `state`. `seen` collects every villager ID met so far across calls, so a villager
 * missing now counts as a death.
 */
export function measure(state: GameState, content: Content, seen: Set<EntityId>): DayReport {
  const { villager, stockpile, building } = state.components;
  const alive = idsOf(villager);
  for (const id of alive) seen.add(id);

  const stock = Object.fromEntries(Object.keys(content.resources).map((r) => [r, 0])) as Record<
    ResourceId,
    number
  >;
  for (const pile of Object.values(stockpile)) {
    for (const goods of Object.values(pile.goods)) stock[goods.resource] += goods.amount;
  }
  for (const b of Object.values(building)) {
    for (const buffer of [b.stock, b.input]) {
      for (const [resource, amount] of Object.entries(buffer)) {
        stock[resource as ResourceId] += amount ?? 0;
      }
    }
  }

  const time = calendarAt(state.tick, content);
  const season = content.calendar.seasons.find((s) => s.id === time.season)?.name ?? time.season;
  return {
    tick: state.tick,
    date: `Y${time.year} ${season} ${time.dayOfSeason}`,
    population: alive.length,
    deaths: seen.size - alive.length,
    carriersBusy: carrierUtilization(state, content),
    stock,
  };
}

/** Runs `scenario` and reports at the start, at every Dawn after it, and at the last tick. */
export function runScenario(scenario: Scenario, content: Content): DayReport[] {
  const state = createInitialState(scenario.seed, scenario.map, content);
  const seen = new Set<EntityId>();
  const reports = [measure(state, content, seen)];
  for (let i = 0; i < scenario.ticks; i++) {
    stepInPlace(state, scenario.commands[state.tick] ?? [], content);
    if (isDawn(state.tick, content) || i === scenario.ticks - 1) {
      reports.push(measure(state, content, seen));
    }
  }
  return reports;
}

/**
 * A plain-text table, one row per report: population, deaths, how busy the Carriers were over the
 * last day, and a column per resource.
 */
export function formatTable(reports: DayReport[], content: Content): string {
  const resources = Object.keys(content.resources) as ResourceId[];
  const header = [
    'Tick',
    'Date',
    'Pop',
    'Deaths',
    'Busy',
    ...resources.map((r) => content.resources[r].name),
  ];
  const rows = reports.map((r) => [
    String(r.tick),
    r.date,
    String(r.population),
    String(r.deaths),
    r.carriersBusy === null ? '-' : `${r.carriersBusy}%`,
    ...resources.map((res) => String(r.stock[res])),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  // The date reads best left-aligned; numbers line up on the right.
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => (i === 1 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
      .join('  ')
      .trimEnd();
  const rule = widths.map((w) => '-'.repeat(w)).join('  ');
  return [line(header), rule, ...rows.map(line)].join('\n');
}
