// Five spring nights on the nights map with a prepared layout: the Gloamling from the Den comes to
// the Gate every night and the watchtower shoots it there. A run of about 4 s, so it runs under
// `pnpm test:scenarios`, not `pnpm test`.
import { content } from '@candlemarch/content';
import {
  calendarAt,
  createInitialState,
  duskTick,
  type GameState,
  idsOf,
  isRevealed,
  stepInPlace,
} from '@candlemarch/sim';
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

describe('the nights map under Fog', () => {
  /** The prepared nights run to its end, with Fog on or off. */
  function play(fog: boolean): GameState {
    const { map, seed, ticks, commands } = scenarios.nights;
    const s = createInitialState(seed, map, content, 100, fog);
    while (s.tick < ticks) stepInPlace(s, commands[s.tick] ?? [], content);
    return s;
  }

  /** `s` without what only Fog changes: what the player has seen, and the static layers' count. */
  function world(s: GameState): unknown {
    const { fog: _, staticVersion: __, ...rest } = s;
    return { ...rest, map: { ...s.map, revealed: [], inSight: [] } };
  }

  it('gives the same nights, deaths and all, with Fog on as with it off', {
    timeout: 60_000,
  }, () => {
    const off = play(false);
    const on = play(true);
    expect(on.deaths).toEqual(off.deaths);
    expect(world(on)).toEqual(world(off));
    // Fog was on, and did hide something: the Den's tile was never Revealed.
    const [den] = idsOf(on.components.den);
    const denTile = on.components.tile[den as number];
    expect(denTile && isRevealed(on, denTile)).toBe(false);
  });
});
