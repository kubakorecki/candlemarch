import { describe, expect, it } from 'vitest';
import { SIM_DEPENDS_ON, SIM_PACKAGE } from '../src/index';

describe('sim', () => {
  it('loads and resolves content', () => {
    expect(SIM_PACKAGE).toBe('sim');
    expect(SIM_DEPENDS_ON).toBe('content');
  });
});
