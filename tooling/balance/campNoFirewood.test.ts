// The Starting Camp that never splits firewood: it freezes in its first winter, warned first.
// A run of about 9 s, so it has a file to itself and runs alongside the rest of the suite.
import { content } from '@candlemarch/content';
import { type Alert, alerts, createInitialState, idsOf, step } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';

const { dayTicks } = content.calendar;
const winterDawn = 15 * dayTicks; // Dawn of day 16, winter's first

describe('the Camp without firewood', () => {
  it('freezes in its first winter, with alerts first', { timeout: 60_000 }, () => {
    const { map, seed, ticks, commands } = scenarios.campNoFirewood;
    let s = createInitialState(seed, map, content);
    const population = idsOf(s.components.villager).length;
    // The tick each alert kind was first seen on, checked every 3 in-game seconds.
    const firstSeen = new Map<Alert['kind'], number>();
    let firstDeath: number | null = null;
    while (s.gameOver === null && s.tick < ticks) {
      s = step(s, commands[s.tick] ?? [], content);
      if (firstDeath === null && idsOf(s.components.villager).length < population) {
        firstDeath = s.tick;
      }
      if (s.tick % 60 === 0) {
        for (const a of alerts(s, content))
          if (!firstSeen.has(a.kind)) firstSeen.set(a.kind, s.tick);
      }
    }

    expect(s.gameOver?.cause).toBe('freezing');
    expect(s.deaths.map((d) => d.cause)).toEqual(Array(population).fill('freezing'));
    // Amber through autumn, before any winter night; red the night before they freeze.
    expect(firstSeen.get('noFirewood')).toBeLessThan(winterDawn);
    expect(firstSeen.get('willFreeze')).toBeLessThan(firstDeath ?? 0);
  });
});
