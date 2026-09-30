// A sensible start on the generated Valley of seed 1 feeds itself through the first year, with a
// Newcomer, off forage and winter hunting alone (food-balance/05). A run of several seconds, so it
// runs under `pnpm test:scenarios`, not `pnpm test`.
import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { runScenario } from './harness';
import { scenarios } from './scenarios';

describe('the Valley with a sensible layout', () => {
  it('is alive at spring of year 2, grown and nobody lost', { timeout: 60_000 }, () => {
    const reports = runScenario(scenarios.valley, content);
    const last = reports.at(-1);
    expect(last?.date).toBe('Y2 Spring 1');
    expect(last?.deaths).toBe(0);
    expect(last?.population).toBeGreaterThanOrEqual(6);
  });
});
