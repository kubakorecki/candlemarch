// Starting a game: on a generated Valley from a seed, or on a hand-made map.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { isGranary } from './granary';
import { entityLayout } from './grid';
import { createInitialState } from './map';
import { type MapName, maps } from './maps';
import type { GameState, Point } from './state';
import { generateValley } from './valley/generate';

/** What a new game starts on: a generated Valley, or a hand-made map by name. */
export type NewGameMap = 'valley' | MapName;

export interface NewGameSetup {
  map: NewGameMap;
  /** Seeds the game's PRNG and, for a Valley, its layout. */
  seed: number;
  /** 0–100. */
  monsterRate: number;
  fog: boolean;
}

/** The state a new game starts from. The same setup always gives the same state. */
export function newGame(setup: NewGameSetup, content: Content): GameState {
  const { map, seed, monsterRate, fog } = setup;
  const def = map === 'valley' ? generateValley(seed, content) : maps[map];
  return createInitialState(seed, def, content, monsterRate, fog);
}

/**
 * Where the camera starts, in tiles (a tile's corner at whole numbers): the middle of the first
 * Granary by ID (a Valley's Camp), or the map's middle when there's none.
 */
export function campCentre(state: GameState, content: Content): Point {
  for (const id of idsOf(state.components.building)) {
    const layout = isGranary(state, content, id) ? entityLayout(state, content, id) : null;
    if (layout) {
      return {
        x: layout.origin.x + layout.size.w / 2,
        y: layout.origin.y + layout.size.h / 2,
      };
    }
  }
  return { x: state.map.width / 2, y: state.map.height / 2 };
}
