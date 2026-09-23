// Hauling is delegated to the game's logistics model.
import type { Content } from '@candlemarch/content';
import { logisticsModels } from '../logistics';
import type { GameState } from '../state';

export function haulingSystem(state: GameState, content: Content): void {
  logisticsModels[state.logistics.model].update(state, content);
}
