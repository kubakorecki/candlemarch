import { performance } from 'node:perf_hooks';
import { content } from '@candlemarch/content';
import { generateValley } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';

describe('the Valley generator', () => {
  it(`lays out a ${content.valley.size}² Valley in under a second`, () => {
    const start = performance.now();
    const v = generateValley(3, content);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(v.rows).toHaveLength(content.valley.size);
  });
});
