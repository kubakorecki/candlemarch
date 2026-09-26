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
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('fills in state added after the save was made', () => {
    const s = createInitialState(9, meadowMap, content);
    const data = JSON.parse(serialize(s));
    delete data.components.site;
    delete data.components.stockpile;
    delete data.logistics;
    delete data.map.roads;
    expect(deserialize(JSON.stringify(data))).toEqual(s);
  });

  it('gives stockpiles saved before priorities and filters the defaults', () => {
    const s = createInitialState(9, maps.shortHaul, content);
    const data = JSON.parse(serialize(s));
    for (const pile of Object.values(data.components.stockpile) as Record<string, unknown>[]) {
      delete pile.priority;
      delete pile.refuses;
    }
    expect(Object.keys(data.components.stockpile).length).toBeGreaterThan(0);
    expect(deserialize(JSON.stringify(data))).toEqual(s);
  });

  it('rejects saves from another version', () => {
    const s = createInitialState(9, meadowMap, content);
    expect(() => deserialize(serialize({ ...s, version: 99 as typeof STATE_VERSION }))).toThrow(
      /version/,
    );
    expect(() => deserialize('null')).toThrow(/version/);
  });
});
