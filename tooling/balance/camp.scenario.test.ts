// The Starting Camp's first year, played headless with the scripted sensible layout. The whole
// run takes about 7 s, so it runs under `pnpm test:scenarios`, not `pnpm test`.
import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { runScenario } from './harness';
import { scenarios } from './scenarios';

describe('the Camp with a sensible layout', () => {
  it('is alive at spring of year 2, nobody lost', { timeout: 60_000 }, () => {
    const reports = runScenario(scenarios.camp, content);
    const last = reports.at(-1);
    expect(last?.date).toBe('Y2 Spring 1');
    expect(last?.population).toBeGreaterThan(0);
    expect(last?.deaths).toBe(0);
  });
});
