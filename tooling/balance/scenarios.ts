// Balance scenarios `pnpm balance <name>` can run, keyed by name.
import { content } from '@candlemarch/content';
import { maps } from '@candlemarch/sim';
import type { Scenario } from './harness';

export const scenarios = {
  /** The meadow for one in-game day, with a stockpile by the woodcutter's hut from the start. */
  meadow: {
    name: 'meadow',
    map: maps.meadow,
    seed: 1,
    ticks: content.calendar.dayTicks,
    commands: { 0: [{ type: 'placeStockpile', x: 11, y: 13, w: 2, h: 2 }] },
  },
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof scenarios;
