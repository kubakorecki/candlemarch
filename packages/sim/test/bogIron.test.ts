// Bog iron (spec, Resources: Renewing what runs out): every Swamp tile holds a little iron ore, back
// up to its cap each spring. A bog-iron digger digs it slowly; Draining a tile loses it for good.
import { describe, expect, it } from 'vitest';
import { bogIronLost, bogIronNear, oreAt } from '../src/bogIron';
import { workplaceStatus } from '../src/bottlenecks';
import { dawnTick } from '../src/calendar';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { GameState, Tile } from '../src/state';
import { content, run, runUntil } from './helpers';

const CAP = content.terrain.swamp.ore?.cap ?? 0;
const YARD = content.logistics.yardCapacity;

/**
 * A Swamp of 8 tiles at x 5–8, y 1–2 (16 bog iron at the start), a bog-iron digger at (2,1) (ID 1:
 * door (2,2), yard (3,1); radius 6 reaches x 8) and its bog digger 2, and a Granary with fish and
 * a Hut so it lasts. No Carrier, so the yard fills up.
 */
const marsh: MapDef = {
  name: 'marsh',
  rows: ['..........', '.....,,,,.', '.....,,,,.', '..........', '..........', '..........'],
  buildings: [
    { type: 'bog_iron_digger', x: 2, y: 1 },
    { type: 'granary', x: 5, y: 3, stock: [{ resource: 'fish', amount: 40 }] },
    { type: 'hut', x: 0, y: 3 },
  ],
  villagers: [],
};
const DIGGER = 1;
const SWAMP: Tile[] = [5, 6, 7, 8].flatMap((x) => [
  { x, y: 1 },
  { x, y: 2 },
]);

const ore = (s: GameState) => SWAMP.reduce((n, t) => n + oreAt(s, content, t), 0);
const yard = (s: GameState) => s.components.building[DIGGER]?.stock.iron_ore ?? 0;

/** `s` jumped to the Dawn of `day` and run through it. */
const dawnOf = (s: GameState, day: number) => run({ ...s, tick: dawnTick(day, content) }, 1);

/** The marsh with the digger's yard filled by digging. */
function dug(): GameState {
  const s0 = createInitialState(1, marsh, content);
  return runUntil(s0, (s) => yard(s) >= YARD, 40_000);
}

describe('bog iron', () => {
  it('is in every Swamp tile, up to its cap, and nowhere else', () => {
    const s = createInitialState(1, marsh, content);
    expect(CAP).toBeGreaterThan(0);
    for (const t of SWAMP) expect(oreAt(s, content, t)).toBe(CAP);
    expect(oreAt(s, content, { x: 4, y: 1 })).toBe(0);
  });

  it("is dug by the bog-iron digger's worker into its yard", () => {
    const s = dug();
    expect(yard(s)).toBe(YARD);
    expect(ore(s)).toBe(SWAMP.length * CAP - YARD);
    // Full: it digs no more, and says so.
    expect(ore(run(s, 1000))).toBe(SWAMP.length * CAP - YARD);
    expect(workplaceStatus(s, content, DIGGER)).toEqual({
      kind: 'outputFull',
      resources: ['iron_ore'],
    });
  });

  it('comes back up to its cap at the first Dawn of spring, and not before', () => {
    const s = dug();
    const winter = dawnOf(s, 16);
    expect(ore(winter)).toBe(SWAMP.length * CAP - YARD);
    const spring = dawnOf(winter, 21);
    for (const t of SWAMP) expect(oreAt(spring, content, t)).toBe(CAP);
  });

  it('is lost for good on a Drained tile', () => {
    const drained = createInitialState(
      1,
      {
        ...marsh,
        rows: ['..........', '.....,,,..', '.....,,,..', '..........', '..........', '..........'],
      },
      content,
    );
    // (8,1) and (8,2) start as Meadow: a Drained tile is Meadow, and spring brings nothing back.
    expect(oreAt(drained, content, { x: 8, y: 1 })).toBe(0);
    expect(oreAt(dawnOf(drained, 21), content, { x: 8, y: 1 })).toBe(0);
  });

  it('goes with a finished Drain', () => {
    const s0 = createInitialState(
      1,
      {
        ...marsh,
        buildings: [],
        stockpiles: [{ x: 0, y: 0, w: 2, h: 1, goods: [{ resource: 'logs', amount: 4 }] }],
        villagers: [{ job: 'carrier', x: 3, y: 3 }],
      },
      content,
    );
    const lay = {
      type: 'layGroundwork',
      building: 'drain',
      from: { x: 5, y: 1 },
      to: { x: 6, y: 1 },
    } as const;
    const s = runUntil(
      run(s0, 1, { 0: [lay] }),
      (s) => s.map.terrain[1 * s.map.width + 6] === 'meadow',
      5000,
    );
    expect(oreAt(s, content, { x: 5, y: 1 })).toBe(0);
    expect(oreAt(s, content, { x: 6, y: 1 })).toBe(0);
    expect(oreAt(s, content, { x: 7, y: 1 })).toBe(CAP);
  });

  it("is what a Drain's preview says it would lose", () => {
    const s = dug();
    const lost = bogIronLost(s, content, 'drain', { x: 5, y: 1 }, { x: 8, y: 1 });
    const expected = [5, 6, 7, 8].reduce((n, x) => n + oreAt(s, content, { x, y: 1 }), 0);
    expect(lost).toBe(expected);
    expect(bogIronLost(s, content, 'drain', { x: 1, y: 3 }, { x: 3, y: 3 })).toBe(0); // not Swamp
  });

  it("is what the digger's placement preview counts in its radius", () => {
    const s = createInitialState(1, { ...marsh, buildings: [] }, content);
    expect(bogIronNear(s, content, 'bog_iron_digger', { x: 2, y: 1 })).toBe(SWAMP.length * CAP);
    expect(bogIronNear(s, content, 'bog_iron_digger', { x: 1, y: 1 })).toBe(
      (SWAMP.length - 2) * CAP,
    );
    expect(bogIronNear(s, content, 'hut', { x: 2, y: 1 })).toBe(0);
  });

  it('carries on from a save as if never saved', () => {
    const saved = run(createInitialState(1, marsh, content), 600);
    const a = run(saved, 900);
    expect(run(deserialize(serialize(saved), content), 900)).toEqual(a);
  });
});
