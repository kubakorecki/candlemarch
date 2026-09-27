// Death. A villager who starves or freezes is removed at once: goods in its hands (a haul, a
// hunter's bag, a batch under way) are lost, its House place frees up and its Workplace position
// opens for staffing to fill. The death is recorded in `state.deaths`.
import type { Content } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { destroyEntity } from './entities';
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
  state.deaths.push({ name: v.name, cause, day: calendarAt(state.tick, content).day });
  delete state.logistics.hauls[id];
  destroyEntity(state, id);
}
