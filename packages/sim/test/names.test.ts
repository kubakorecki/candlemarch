import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { maps } from '../src/maps';
import { deserialize, serialize } from '../src/save';
import type { GameState } from '../src/state';
import { content, run } from './helpers';

function names(s: GameState): string[] {
  return idsOf(s.components.villager).map((id) => s.components.villager[id]?.name ?? '');
}

/** An open 6×2 map with `count` carriers. */
function crowd(count: number): MapDef {
  return {
    name: 'crowd',
    rows: ['......', '......'],
    buildings: [],
    villagers: Array.from({ length: count }, (_, i) => ({ job: 'carrier', x: i % 6, y: 0 })),
  };
}

describe('villager names', () => {
  it('names every villager from the content pool', () => {
    const s = createInitialState(1, maps.branchingNetwork, content);
    expect(names(s).length).toBeGreaterThan(1);
    for (const name of names(s)) expect(content.villagerNames).toContain(name);
  });

  it('draws the same names for the same seed', () => {
    const a = createInitialState(7, maps.branchingNetwork, content);
    const b = createInitialState(7, maps.branchingNetwork, content);
    expect(names(a)).toEqual(names(b));
    expect(a.rng).toBe(b.rng);
  });

  it('draws different names for different seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 5; seed++) {
      seen.add(names(createInitialState(seed, maps.branchingNetwork, content)).join(','));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('avoids duplicates while unused names remain', () => {
    const small = { ...content, villagerNames: ['Ada', 'Hugh', 'Maud'] };
    expect(names(createInitialState(3, crowd(3), small)).sort()).toEqual(['Ada', 'Hugh', 'Maud']);
    const four = names(createInitialState(3, crowd(4), small));
    expect(new Set(four).size).toBe(3);
    for (const name of four) expect(small.villagerNames).toContain(name);
  });

  it('keeps names through save and load', () => {
    const s = run(createInitialState(4, maps.meadow, content), 50);
    const loaded = deserialize(serialize(s), content);
    expect(names(loaded)).toEqual(names(s));
    expect(run(loaded, 50)).toEqual(run(s, 50));
  });

  it('names villagers from saves made before names, by ID', () => {
    const s = createInitialState(4, maps.branchingNetwork, content);
    const data = JSON.parse(serialize(s));
    for (const v of Object.values(data.components.villager) as Record<string, unknown>[]) {
      delete v.name;
    }
    const loaded = deserialize(JSON.stringify(data), content);
    const ids = idsOf(loaded.components.villager);
    expect(names(loaded)).toEqual(
      ids.map((id) => content.villagerNames[(id - 1) % content.villagerNames.length]),
    );
    expect(deserialize(JSON.stringify(data), content)).toEqual(loaded);
  });
});
