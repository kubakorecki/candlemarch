// Death. A villager who starves or freezes is removed at once: goods in its hands (a haul, a
// hunter's bag, a batch under way) are lost, its House place frees up and its Workplace position
// opens for staffing to fill. The death is recorded in `state.deaths`. When the last villager
// dies, the game is over (`state.gameOver`).
import type { Content } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { destroyEntity, idsOf } from './entities';
import type { DeathCause, EntityId, GameState } from './state';

/** Villager `id` dies of `cause` now. Ignored if it isn't a villager. */
export function killVillager(
  state: GameState,
  content: Content,
  id: EntityId,
  cause: DeathCause,
): void {
  const v = state.components.villager[id];
  if (!v) return;
  const day = calendarAt(state.tick, content).day;
  state.deaths.push({ name: v.name, cause, day });
  delete state.logistics.hauls[id];
  destroyEntity(state, id);
  if (state.gameOver === null && idsOf(state.components.villager).length === 0) {
    state.gameOver = { day, cause };
  }
}
