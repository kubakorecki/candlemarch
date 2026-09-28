// The nights map left as it is: nothing stops the Gloamling from the Den, and it breaks into the
// Huts. A run of about 3 s, so it runs under `pnpm test:scenarios`, not `pnpm test`.
import { content } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { runScenario } from './harness';
import { scenarios } from './scenarios';

describe('the nights map, unprepared', () => {
  it('loses villagers to the Gloamlings within five nights', { timeout: 60_000 }, () => {
    const reports = runScenario(scenarios.nightsUnprepared, content);
    const last = reports.at(-1);
    expect(last?.date).toBe('Y1 Summer 1');
    // Every death is on the record by cause, including a Newcomer's who came and died between
    // two Dawns.
    expect(last?.deathsBy.gloamling).toBeGreaterThanOrEqual(3);
    expect(last?.deathsBy).toMatchObject({ starvation: 0, freezing: 0, den: 0 });
  });
});
