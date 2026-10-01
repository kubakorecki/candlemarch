import type { Content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { rankLock, rankProgress } from '../src/ranks';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run } from './helpers';

const HALL = { type: 'placeBuilding', building: 'village_hall', x: 4, y: 1 } as const;

/** A meadow with `villagers` Carriers on its bottom row and the hall's goods on a Stockpile. */
function field(villagers: number): MapDef {
  return {
    name: 'ranks',
    rows: Array.from({ length: 10 }, () => '..............'),
    buildings: [],
    stockpiles: [
      {
        x: 0,
        y: 0,
        w: 3,
        h: 3,
        goods: [
          { resource: 'logs', amount: 40 },
          { resource: 'stone', amount: 20 },
        ],
      },
    ],
    villagers: Array.from({ length: villagers }, (_, i) => ({
      job: 'carrier' as const,
      x: i,
      y: 9,
    })),
  };
}

function campOf(villagers: number): GameState {
  return createInitialState(1, field(villagers), content);
}

function hasSite(s: GameState, type: string): boolean {
  return Object.values(s.components.site).some((site) => site.type === type);
}

function hasBuilding(s: GameState, type: string): boolean {
  return Object.values(s.components.building).some((b) => b.type === type);
}

/** Places the hall on the first tick and runs until it stands (or `max` ticks). */
function buildHall(s: GameState, max = 3000): GameState {
  let out = run(s, 1, { [s.tick]: [HALL] });
  for (let i = 0; i < max && !hasBuilding(out, 'village_hall'); i++) out = run(out, 1);
  return out;
}

const needed = content.ranks.find((r) => r.id === 'hamlet')?.residents ?? 0;

describe('ranks', () => {
  it('a new game starts at Camp', () => {
    expect(campOf(3).rank).toBe('camp');
  });

  it("refuses the village hall below Hamlet's resident requirement and accepts it at it", () => {
    expect(needed).toBeGreaterThan(1);
    const short = campOf(needed - 1);
    expect(canPlaceBuilding(short, content, 'village_hall', 4, 1)).toBe(false);
    expect(hasSite(run(short, 1, { 0: [HALL] }), 'village_hall')).toBe(false);

    const enough = campOf(needed);
    expect(canPlaceBuilding(enough, content, 'village_hall', 4, 1)).toBe(true);
    expect(hasSite(run(enough, 1, { 0: [HALL] }), 'village_hall')).toBe(true);
  });

  it('completing the village hall raises the village to Hamlet', () => {
    const s = buildHall(campOf(needed));
    expect(hasBuilding(s, 'village_hall')).toBe(true);
    expect(s.rank).toBe('hamlet');
  });

  it('the village stays a Hamlet once villagers leave or die', () => {
    const s = buildHall(campOf(needed));
    for (const id of idsOf(s.components.villager).slice(1)) delete s.components.villager[id];
    expect(run(s, 5).rank).toBe('hamlet');
  });

  describe('unlocks', () => {
    // A test Content where the woodcutter's hut is a Hamlet building.
    const hamletHut: Content = {
      ...content,
      ranks: content.ranks.map((r) => ({
        ...r,
        unlocks: {
          buildings:
            r.id === 'hamlet'
              ? [...r.unlocks.buildings, 'woodcutters_hut']
              : r.unlocks.buildings.filter((b) => b !== 'woodcutters_hut'),
        },
      })),
    };

    it('a building unlocked at Hamlet is refused at Camp and placeable once a Hamlet', () => {
      const camp = createInitialState(1, field(needed), hamletHut);
      expect(canPlaceBuilding(camp, hamletHut, 'woodcutters_hut', 10, 1)).toBe(false);
      const hut: Command = { type: 'placeBuilding', building: 'woodcutters_hut', x: 10, y: 1 };
      expect(hasSite(run(camp, 1, { 0: [hut] }, hamletHut), 'woodcutters_hut')).toBe(false);

      const hamlet = buildHall(camp);
      expect(hamlet.rank).toBe('hamlet');
      expect(canPlaceBuilding(hamlet, hamletHut, 'woodcutters_hut', 10, 1)).toBe(true);
    });

    it('the build menu is told what unlocks a locked building', () => {
      const camp = createInitialState(1, field(needed), hamletHut);
      expect(rankLock(camp, hamletHut, 'woodcutters_hut')).toEqual({
        kind: 'rank',
        rank: 'hamlet',
      });
      expect(rankLock(camp, hamletHut, 'hut')).toBeNull();
      expect(rankLock(buildHall(camp), hamletHut, 'woodcutters_hut')).toBeNull();
    });
  });

  it("the build menu is told a rank building's residents against its requirement", () => {
    expect(rankLock(campOf(needed - 3), content, 'village_hall')).toEqual({
      kind: 'residents',
      residents: needed - 3,
      needed,
    });
    expect(rankLock(campOf(needed), content, 'village_hall')).toBeNull();
  });

  describe('progress', () => {
    it('counts residents toward the next rank', () => {
      expect(rankProgress(campOf(needed - 2), content)).toEqual({
        rank: 'camp',
        next: {
          rank: 'hamlet',
          building: 'village_hall',
          residents: needed - 2,
          needed,
          underway: false,
        },
      });
    });

    it('says when the rank building is under way', () => {
      const s = run(campOf(needed), 1, { 0: [HALL] });
      expect(rankProgress(s, content).next?.underway).toBe(true);
    });

    it('has no next rank once a Hamlet: the tavern is not in the game yet', () => {
      expect(rankProgress(buildHall(campOf(needed)), content)).toEqual({
        rank: 'hamlet',
        next: null,
      });
    });
  });

  it('is deterministic, and a save mid-build continues as an uninterrupted run', () => {
    const start = campOf(needed);
    const a = buildHall(start);
    const b = buildHall(start);
    expect(a).toEqual(b);

    const placed = run(start, 1, { 0: [HALL] });
    const ticks = a.tick - placed.tick;
    const mid = run(placed, Math.floor(ticks / 2));
    const loaded = deserialize(serialize(mid), content);
    const resumed = run(loaded, ticks - Math.floor(ticks / 2));
    expect(resumed.rank).toBe('hamlet');
    expect(resumed).toEqual(a);
  });

  it('an old save without a rank loads at Camp', () => {
    const json = JSON.parse(serialize(campOf(2)));
    delete json.rank;
    expect(deserialize(JSON.stringify(json), content).rank).toBe('camp');
  });
});
