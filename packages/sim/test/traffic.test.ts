import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { step } from '../src/step';
import { walkTo } from '../src/systems/movement';
import { carrierUtilization, roadTraffic } from '../src/traffic';
import { content, run } from './helpers';

const DAY = content.calendar.dayTicks;

// A woodcutter's hut at (1,1) (door (2,3)), a stockpile at (8,3), two Carriers, and a path along
// row 3 from (3,3) to (7,3). No trees: the woodcutter stays home.
const lane: MapDef = {
  name: 'lane',
  rows: ['..........', '..........', '..........', '...=====..', '..........', '..........'],
  buildings: [{ type: 'woodcutters_hut', x: 1, y: 1 }],
  stockpiles: [{ x: 8, y: 3, w: 1, h: 1 }],
  villagers: [
    { job: 'carrier', x: 4, y: 5 },
    { job: 'carrier', x: 5, y: 5 },
  ],
};

function carriers(s: GameState): EntityId[] {
  return idsOf(s.components.villager).filter((id) => s.components.villager[id]?.job === 'carrier');
}

/** The lane with `logs` in the woodcutter's hut's output buffer. */
function laneWith(logs: number): GameState {
  const s = createInitialState(1, lane, content);
  const hut = idsOf(s.components.building)[0] as EntityId;
  const b = s.components.building[hut];
  if (b) b.stock.logs = logs;
  return s;
}

describe('carrier utilization', () => {
  it('is unknown before any Carrier has worked a tick', () => {
    expect(carrierUtilization(laneWith(0), content)).toBeNull();
  });

  it('is 0% while no Carrier holds a Haul', () => {
    expect(carrierUtilization(run(laneWith(0), 100), content)).toBe(0);
  });

  it('is the share of Carrier-ticks spent holding a Haul', () => {
    // One log: one Carrier hauls it to the stockpile while the other stands idle.
    let s = laneWith(1);
    let holding = 0;
    const ticks = 400;
    for (let i = 0; i < ticks; i++) {
      s = step(s, [], content);
      holding += carriers(s).filter((id) => s.logistics.hauls[id] !== undefined).length;
    }
    expect(holding).toBeGreaterThan(0);
    expect(carrierUtilization(s, content)).toBe(Math.floor((100 * holding) / (2 * ticks)));
  });

  it('forgets Hauls older than a day', () => {
    const busy = run(laneWith(1), 400);
    expect(carrierUtilization(busy, content)).toBeGreaterThan(0);
    // A day and more of nothing to haul.
    expect(carrierUtilization(run(busy, DAY + 200), content)).toBe(0);
  });

  it('counts only Carriers at work, not asleep at night', () => {
    // Jump to the middle of the first night: everyone is off work, so no samples.
    const s = laneWith(0);
    s.tick = DAY - 100;
    const night = run(s, 50);
    expect(Object.values(night.components.villager).every((v) => v.routine !== 'work')).toBe(true);
    expect(carrierUtilization(night, content)).toBeNull();
  });
});

describe('road traffic', () => {
  it('counts Carrier steps onto each Road tile', () => {
    const s = laneWith(0);
    const [first] = carriers(s);
    const id = first as EntityId;
    s.components.position[id] = { x: 2500, y: 3500 }; // (2,3), just off the path
    walkTo(s, content, id, [{ x: 9, y: 3 }]);
    const walked = run(s, 200);
    const w = s.map.width;
    expect(roadTraffic(walked, content)).toEqual({
      [3 * w + 3]: 1,
      [3 * w + 4]: 1,
      [3 * w + 5]: 1,
      [3 * w + 6]: 1,
      [3 * w + 7]: 1,
    });
  });

  it("doesn't count other walkers", () => {
    // The hero walks the whole path.
    const s = createInitialState(1, { ...lane, hero: { x: 2, y: 3 } }, content);
    const hero = idsOf(s.components.hero)[0] as EntityId;
    walkTo(s, content, hero, [{ x: 9, y: 3 }]);
    const walked = run(s, 200);
    expect(walked.components.position[hero]).toEqual({ x: 9500, y: 3500 });
    expect(roadTraffic(walked, content)).toEqual({});
  });

  it('forgets steps older than a day', () => {
    const s = laneWith(0);
    const id = carriers(s)[0] as EntityId;
    s.components.position[id] = { x: 2500, y: 3500 };
    walkTo(s, content, id, [{ x: 9, y: 3 }]);
    const walked = run(s, 200);
    expect(Object.keys(roadTraffic(walked, content))).toHaveLength(5);
    walked.tick += DAY;
    expect(roadTraffic(walked, content)).toEqual({});
  });
});

describe('traffic in saves', () => {
  it('survives a save and load', () => {
    const s = run(laneWith(1), 300);
    const loaded = deserialize(serialize(s), content);
    expect(run(loaded, 100)).toEqual(run(s, 100));
  });

  it('starts empty in a save made before it existed', () => {
    const s = laneWith(0);
    const { traffic: _, ...old } = s;
    const loaded = deserialize(JSON.stringify(old), content);
    expect(loaded.traffic).toEqual([]);
    expect(carrierUtilization(loaded, content)).toBeNull();
  });
});
