// The seam between hauling and the rest of the sim. Two models will be prototyped
// (job dispatch now, Settlers-style flag relay later); each keeps its own plain-data state.
import type { Content } from '@candlemarch/content';
import type { GameState } from '../state';
import type { JobDispatchState } from './jobDispatch';

/** Logistics state of whichever model the game uses. Extend the union for new models. */
export type LogisticsState = JobDispatchState;
export type LogisticsModelId = LogisticsState['model'];

export interface LogisticsModel {
  /** Initial logistics state for a new game. */
  init(): LogisticsState;
  /** Runs once per tick, after production and before construction. Mutates `state`. */
  update(state: GameState, content: Content): void;
}
