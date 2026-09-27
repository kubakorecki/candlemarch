import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/map';
import { maps } from '../src/maps';
import { meadowMap } from '../src/maps/meadow';
import { deserialize, serialize } from '../src/save';
import type { STATE_VERSION } from '../src/state';
import { content } from './helpers';

describe('serialize / deserialize', () => {
  it('round-trips a state', () => {
    const s = createInitialState(9, meadowMap, content);
    expect(deserialize(serialize(s), content)).toEqual(s);
  });

  it('fills in state added after the save was made', () => {
    const s = createInitialState(9, meadowMap, content);
    const data = JSON.parse(serialize(s));
    delete data.components.site;
    delete data.components.stockpile;
    delete data.logistics;
    delete data.deaths;
    delete data.gameOver;
    delete data.map.roads;
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });

  it('gives maps saved before immigration no entry', () => {
    const data = JSON.parse(serialize(createInitialState(9, meadowMap, content)));
    delete data.map.entry;
    expect(deserialize(JSON.stringify(data), content).map.entry).toBeNull();
  });

  it('gives stockpiles saved before priorities and filters the defaults', () => {
    const s = createInitialState(9, maps.shortHaul, content);
    const data = JSON.parse(serialize(s));
    for (const pile of Object.values(data.components.stockpile) as Record<string, unknown>[]) {
      delete pile.priority;
      delete pile.refuses;
    }
    expect(Object.keys(data.components.stockpile).length).toBeGreaterThan(0);
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });

  it('gives buildings saved before input buffers an empty one', () => {
    const s = createInitialState(9, meadowMap, content);
    const data = JSON.parse(serialize(s));
    for (const b of Object.values(data.components.building) as Record<string, unknown>[]) {
      delete b.input;
    }
    delete data.components.crafter;
    expect(Object.keys(data.components.building).length).toBeGreaterThan(0);
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });

  it('gives villagers saved before Homes and sleep none: Homeless, at work and rested', () => {
    const s = createInitialState(9, meadowMap, content);
    const data = JSON.parse(serialize(s));
    for (const v of Object.values(data.components.villager) as Record<string, unknown>[]) {
      delete v.home;
      delete v.routine;
      delete v.sleptTicks;
      delete v.tired;
    }
    expect(Object.keys(data.components.villager).length).toBeGreaterThan(0);
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });

  it('gives villagers and buildings saved before warmth no cold', () => {
    const s = createInitialState(9, meadowMap, content);
    const data = JSON.parse(serialize(s));
    for (const v of Object.values(data.components.villager) as Record<string, unknown>[]) {
      delete v.coldNights;
    }
    for (const b of Object.values(data.components.building) as Record<string, unknown>[]) {
      delete b.cold;
    }
    expect(deserialize(JSON.stringify(data), content)).toEqual(s);
  });

  it('rejects saves from another version', () => {
    const s = createInitialState(9, meadowMap, content);
    expect(() =>
      deserialize(serialize({ ...s, version: 99 as typeof STATE_VERSION }), content),
    ).toThrow(/version/);
    expect(() => deserialize('null', content)).toThrow(/version/);
  });
});
