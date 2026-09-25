import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/map';
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
    delete data.logistics;
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
