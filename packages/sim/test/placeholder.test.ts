import { describe, expect, it } from 'vitest';
import { SIM_PACKAGE } from '../src/index';

describe('sim', () => {
  it('loads', () => {
    expect(SIM_PACKAGE).toBe('sim');
  });
});
