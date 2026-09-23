import { SIM_PACKAGE } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';

describe('client', () => {
  it('resolves sim', () => {
    expect(SIM_PACKAGE).toBe('sim');
  });
});
