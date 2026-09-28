// Five spring nights on the nights map with a prepared layout: the Gloamling from the Den comes to
// the Gate every night and the watchtower shoots it there. A run of about 4 s, so it runs under
// `pnpm test:scenarios`, not `pnpm test`.
import { content } from '@candlemarch/content';
import { calendarAt, createInitialState, duskTick, idsOf, stepInPlace } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';

describe('the nights map, prepared', () => {
  it('survives five nights with fair losses', { timeout: 60_000 }, () => {
    const { map, seed, ticks, commands } = scenarios.nights;
    const s = createInitialState(seed, map, content);
    const population = idsOf(s.components.villager).length;
    let gateHp = Number.POSITIVE_INFINITY;
    while (s.tick < ticks) {
      stepInPlace(s, commands[s.tick] ?? [], content);
      if (s.tick === duskTick(1, content)) {
        // Everything placed at Dawn stands by the first Dusk, and the tower has its Watchman.
        expect(idsOf(s.components.site)).toEqual([]);
        expect(Object.values(s.components.villager).some((v) => v.job === 'watchman')).toBe(true);
      }
      for (const b of Object.values(s.components.building)) {
        if (b.type === 'gate' && b.hp !== null) gateHp = Math.min(gateHp, b.hp);
      }
    }

    expect(calendarAt(s.tick, content)).toMatchObject({ season: 'summer', dayOfSeason: 1 });
    // The Gloamlings did come: they battered the Gate.
    expect(gateHp).toBeLessThan(content.buildings.gate.wall?.hp ?? 0);
    // Fair losses: one villager at most.
    expect(s.deaths.length).toBeLessThanOrEqual(1);
    expect(idsOf(s.components.villager).length).toBeGreaterThanOrEqual(population - 1);
  });
});
