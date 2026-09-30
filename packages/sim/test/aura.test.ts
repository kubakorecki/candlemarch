import { describe, expect, it } from 'vitest';
import { boostedWorkplaces } from '../src/aura';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { maps } from '../src/maps';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/**
 * A woodcutter's hut at (1,2) (footprint x 1-2, y 2-3, door (2,4)) with two trees to the
 * north-east, and the hero standing wherever a test puts it.
 */
function grove(hero: { x: number; y: number }): MapDef {
  return {
    name: 'grove',
    rows: [
      '..........',
      '.....T....',
      '......T...',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
    buildings: [{ type: 'woodcutters_hut', x: 2, y: 3 }],
    villagers: [],
    hero,
  };
}

const NEAR = { x: 4, y: 5 };
const FAR = { x: 9, y: 7 };

function woodcutterId(s: GameState): number {
  return idsOf(s.components.woodcutter)[0] as number;
}

function hutId(s: GameState): number {
  return idsOf(s.components.building)[0] as number;
}

/** Ticks the woodcutter spends in its first chop. */
function firstChopTicks(s0: GameState, commandsAt: Record<number, Command[]> = {}): number {
  const chopping = (s: GameState) => s.components.woodcutter[woodcutterId(s)]?.kind === 'chopping';
  const start = runUntil(s0, chopping, 500, commandsAt);
  const end = runUntil(start, (s) => !chopping(s), 500, commandsAt);
  return end.tick - start.tick;
}

describe('hero aura', () => {
  it('a woodcutter chops faster with the hero near its hut', () => {
    const without = firstChopTicks(createInitialState(1, grove(FAR), content));
    const withHero = firstChopTicks(createInitialState(1, grove(NEAR), content));
    // A tree takes 40 ticks per chop; at 125% that's 40 × 100 / 125 = 32.
    expect(without).toBe(40);
    expect(withHero).toBe(32);
  });

  it('boosts workplaces with a footprint tile within the radius, measured as a circle', () => {
    const boosted = (hero: { x: number; y: number }) => {
      const s = createInitialState(1, grove(hero), content);
      return boostedWorkplaces(s, content);
    };
    const hut = hutId(createInitialState(1, grove(NEAR), content));
    // Nearest footprint tile is (2,3). Radius 5 tiles.
    expect(boosted({ x: 7, y: 3 })).toEqual([hut]); // 5 east
    expect(boosted({ x: 8, y: 3 })).toEqual([]); // 6 east
    expect(boosted({ x: 5, y: 7 })).toEqual([hut]); // 3 east, 4 south: exactly 5
    expect(boosted({ x: 6, y: 7 })).toEqual([]); // 4 east, 4 south: about 5.7
  });

  it('the boost follows the hero', () => {
    const s0 = createInitialState(1, grove(NEAR), content);
    expect(boostedWorkplaces(s0, content)).toEqual([hutId(s0)]);
    const hero = idsOf(s0.components.hero)[0] as number;
    const away = runUntil(s0, (s) => s.tick > 0 && !s.components.path[hero], 500, {
      0: [{ type: 'orderHero', order: 'move', ...FAR }],
    });
    expect(boostedWorkplaces(away, content)).toEqual([]);
  });

  it('no map starts with the hero boosting a workplace', () => {
    // Keeps the measured scenario timings hero-free; the player walks the hero over.
    for (const map of Object.values(maps)) {
      expect(boostedWorkplaces(createInitialState(1, map, content), content), map.name).toEqual([]);
    }
  });

  it('a work time never drops below one tick', () => {
    const strong = {
      ...content,
      heroes: {
        placeholder: {
          ...content.heroes.placeholder,
          aura: { radiusTiles: 5, speedPercent: 10_000 },
        },
      },
    };
    const s0 = createInitialState(1, grove(NEAR), strong);
    const chopping = (s: GameState) =>
      s.components.woodcutter[woodcutterId(s)]?.kind === 'chopping';
    let s = s0;
    for (let i = 0; i < 500 && !chopping(s); i++) s = run(s, 1, {}, strong);
    const after = run(s, 1, {}, strong);
    expect(chopping(after)).toBe(false);
    expect(after.components.villager[woodcutterId(after)]?.carrying).not.toBeNull();
  });
});
