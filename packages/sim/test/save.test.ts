import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/map';
import { meadowMap } from '../src/maps/meadow';
import { deserialize, serialize } from '../src/save';
import { content } from './helpers';

describe('serialize / deserialize', () => {
  it('round-trips a state', () => {
    const s = createInitialState(9, meadowMap, content);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects saves from another version', () => {
    const s = createInitialState(9, meadowMap, content);
    expect(() => deserialize(serialize({ ...s, version: 99 as 1 }))).toThrow(/version/);
    expect(() => deserialize('null')).toThrow(/version/);
  });
});
