import { describe, expect, it } from 'vitest';
import { CONTENT_PACKAGE } from '../src/index';

describe('content', () => {
  it('loads', () => {
    expect(CONTENT_PACKAGE).toBe('content');
  });
});
