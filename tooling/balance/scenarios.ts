// Balance scenarios `pnpm balance <name>` can run, keyed by name.
import { content } from '@candlemarch/content';
import { type Command, createInitialState, generateValley, maps } from '@candlemarch/sim';
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
      { type: 'placeBuilding', building: 'hunters_lodge', x: 13, y: 12 },
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

/**
 * A prepared nights map, all placed at Dawn of day 1 and built from the Stockpile's logs before
 * the first Dusk: a palisade with a Gate in the middle across the gap in the ridge, a watchtower
 * 4 tiles inside it, whose range covers the Gate and whose door is a short walk from the Granary
 * where its Watchman eats at Dusk, and a brazier lighting the yard between the Granary and the
 * Huts. Walls first: they're what the first night needs most. The Huts stay dark.
 */
const nightsLayout: Record<number, Command[]> = {
  [dawnOf(1)]: [
    { type: 'layWall', building: 'palisade', from: { x: 17, y: 9 }, to: { x: 17, y: 9 } },
    { type: 'layWall', building: 'gate', from: { x: 17, y: 10 }, to: { x: 17, y: 10 } },
    { type: 'layWall', building: 'palisade', from: { x: 17, y: 11 }, to: { x: 17, y: 11 } },
    { type: 'placeBuilding', building: 'watchtower', x: 13, y: 11 },
    { type: 'placeBuilding', building: 'brazier', x: 8, y: 11 },
  ],
};

/** The generated Valley of seed 1. */
const valleyMap = generateValley(1, content);

/** ID the n-th entity created after the seed 1 Valley's own (0-based) will get. */
const valleyId = (n: number) => createInitialState(1, valleyMap, content).nextId + n;

/**
 * A sensible start on the generated Valley of seed 1, whose Granary stands at (54, 10) below the
 * entry, with a wood between it and the river to the west. Day 1: a Hut, a forager's hut and a
 * hunter's lodge on the wood's edge (its berry bushes are by the forager's hut), a woodcutter's
 * hut at the wood's south end. Day 2: a second Stockpile, so hides and firewood both have room.
 * Day 3: a second Hut. Day 6, with the Huts up: the woodcutter stops. Day 11 (autumn): it cuts
 * again and a chopping block splits firewood for winter, until day 15. No fisher's hut: the river
 * is beyond the wood, and five settlers can't staff three food Workplaces and still haul. Worker
 * limits keep two Carriers free. The coordinates are seed 1's: if a generator change moves the
 * land, the harness throws on the first that no longer fits.
 */
function valleyLayout(): Record<number, Command[]> {
  // IDs by the order the commands below create entities: Hut 0, lodge 1, forager's hut 2,
  // woodcutter's hut 3, Stockpile 4, Hut 5, chopping block 6.
  const woodcuttersHut = valleyId(3);
  const choppingBlock = valleyId(6);
  return {
    [dawnOf(1)]: [
      { type: 'placeBuilding', building: 'hut', x: 57, y: 13 },
      { type: 'placeBuilding', building: 'hunters_lodge', x: 51, y: 18 },
      { type: 'placeBuilding', building: 'foragers_hut', x: 50, y: 8 },
      { type: 'placeBuilding', building: 'woodcutters_hut', x: 51, y: 25 },
    ],
    [dawnOf(2)]: [{ type: 'placeStockpile', x: 51, y: 14, w: 3, h: 2 }],
    [dawnOf(3)]: [{ type: 'placeBuilding', building: 'hut', x: 59, y: 13 }],
    [dawnOf(6)]: [{ type: 'setWorkerLimit', building: woodcuttersHut, limit: 0 }],
    [dawnOf(11)]: [
      { type: 'setWorkerLimit', building: woodcuttersHut, limit: 1 },
      { type: 'placeBuilding', building: 'chopping_block', x: 55, y: 14 },
    ],
    [dawnOf(15)]: [
      { type: 'setWorkerLimit', building: woodcuttersHut, limit: 0 },
      { type: 'setWorkerLimit', building: choppingBlock, limit: 0 },
    ],
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
  /**
   * The generated Valley of seed 1 with a sensible layout, Fog off, to Dawn of year 2. No
   * Gloamlings: this one measures food, and the layout builds no defences.
   */
  valley: {
    name: 'valley',
    map: valleyMap,
    seed: 1,
    monsterRate: 0,
    ticks: dawnOf(21) + 1,
    commands: valleyLayout(),
  },
  /** The nights map, prepared (`nightsLayout`), through five spring nights to Dawn of summer. */
  nights: {
    name: 'nights',
    map: maps.nights,
    seed: 1,
    ticks: dawnOf(6) + 1,
    commands: nightsLayout,
  },
  /** The same map left as it is: nothing between the Den and the Huts. */
  nightsUnprepared: {
    name: 'nightsUnprepared',
    map: maps.nights,
    seed: 1,
    ticks: dawnOf(6) + 1,
    commands: {},
  },
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof scenarios;
