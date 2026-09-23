import { TICKS_PER_SECOND } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';

describe('client', () => {
  it('resolves sim', () => {
    expect(TICKS_PER_SECOND).toBe(20);
  });
});
