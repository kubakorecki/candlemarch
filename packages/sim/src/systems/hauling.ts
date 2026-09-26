// Carriers haul goods by job dispatch.
import type { Content } from '@candlemarch/content';
import { updateHauls } from '../logistics/jobDispatch';
import type { GameState } from '../state';

export function haulingSystem(state: GameState, content: Content): void {
  updateHauls(state, content);
}
