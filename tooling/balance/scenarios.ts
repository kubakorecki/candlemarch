// Balance scenarios `pnpm balance <name>` can run, keyed by name.
import { content } from '@candlemarch/content';
import { type Command, createInitialState, maps } from '@candlemarch/sim';
import type { Scenario } from './harness';

const { dayTicks } = content.calendar;
/** Dawn of day `day` (1-based) of the first year. */
const dawnOf = (day: number) => (day - 1) * dayTicks;

/** ID the n-th entity created after the camp map's own (0-based) will get. */
const campId = (n: number) => createInitialState(1, maps.camp, content).nextId + n;

/**
 * A sensible Camp layout. Day 1: paths from the Granary's door, two Huts, a woodcutter's hut at
 * the Pinewood, a fisher's hut on the bank. Day 2: a hunter's lodge at the Old Wood and a second
 * stockpile. Day 5, with those up and logs stocked: the woodcutter stops and a chopping block
 * splits logs into firewood for one day. Day 6: a second fisher's hut. Day 11 (autumn): a
 * forager's hut for the mushrooms. Worker limits keep one or two Carriers free: with four
 * Workplaces on five settlers the lone Carrier can't keep up. Sites are served in the order
 * they're placed. `firewood: false` never builds the chopping block.
 */
function campLayout({ firewood }: { firewood: boolean }): Record<number, Command[]> {
  // IDs by the order the commands below create entities: Huts 0 and 1, woodcutter's hut 2,
  // fisher's hut 3, lodge 4, stockpile 5, chopping block 6.
  const woodcuttersHut = campId(2);
  const choppingBlock = campId(6);
  return {
    [dawnOf(1)]: [
      { type: 'layPath', from: { x: 7, y: 16 }, to: { x: 15, y: 16 } },
      { type: 'layPath', from: { x: 15, y: 16 }, to: { x: 15, y: 9 } },
      { type: 'layPath', from: { x: 12, y: 17 }, to: { x: 12, y: 19 } },
      { type: 'placeBuilding', building: 'hut', x: 9, y: 17 },
      { type: 'placeBuilding', building: 'hut', x: 11, y: 17 },
      { type: 'placeBuilding', building: 'woodcutters_hut', x: 6, y: 10 },
      { type: 'placeBuilding', building: 'fishers_hut', x: 13, y: 18 },
    ],
    [dawnOf(2)]: [
      { type: 'placeBuilding', building: 'hunters_lodge', x: 14, y: 12 },
      { type: 'placeStockpile', x: 9, y: 11, w: 3, h: 2 },
    ],
    [dawnOf(5)]: [
      { type: 'setWorkerLimit', building: woodcuttersHut, limit: 0 },
      ...(firewood
        ? [{ type: 'placeBuilding', building: 'chopping_block', x: 7, y: 14 } as const]
        : []),
    ],
    [dawnOf(6)]: [
      ...(firewood ? [{ type: 'setWorkerLimit', building: choppingBlock, limit: 0 } as const] : []),
      { type: 'placeBuilding', building: 'fishers_hut', x: 15, y: 18 },
    ],
    [dawnOf(11)]: [{ type: 'placeBuilding', building: 'foragers_hut', x: 14, y: 8 }],
  };
}

export const scenarios = {
  /** The meadow for one in-game day, with a stockpile by the woodcutter's hut from the start. */
  meadow: {
    name: 'meadow',
    map: maps.meadow,
    seed: 1,
    ticks: dayTicks,
    commands: { 0: [{ type: 'placeStockpile', x: 11, y: 13, w: 2, h: 2 }] },
  },
  /** The Starting Camp with a sensible layout, through the first winter to Dawn of year 2. */
  camp: {
    name: 'camp',
    map: maps.camp,
    seed: 1,
    ticks: dawnOf(21) + 1,
    commands: campLayout({ firewood: true }),
  },
  /** The same Camp that never builds a chopping block: no firewood for the winter. */
  campNoFirewood: {
    name: 'campNoFirewood',
    map: maps.camp,
    seed: 1,
    ticks: dawnOf(21) + 1,
    commands: campLayout({ firewood: false }),
  },
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof scenarios;
