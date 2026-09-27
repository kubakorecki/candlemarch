// The Starting Camp's first year, played headless with the scripted sensible layout. The whole
// run takes about 10 s, so it has a file to itself and runs alongside the rest of the suite.
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
