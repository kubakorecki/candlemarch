// Villagers' Jobs: giving a villager a Job, a Workplace and that Job's task state.
import type { JobId } from '@candlemarch/content';
import type { EntityId, GameState } from './state';

/**
 * Gives villager `id` a Job and Workplace, replacing its old Job's task state with a fresh one
 * for the new Job. The villager keeps whatever it carries and any walk in progress.
 */
export function assignJob(
  state: GameState,
  id: EntityId,
  job: JobId,
  workplace: EntityId | null,
): void {
  const villager = state.components.villager[id];
  if (!villager) return;
  villager.job = job;
  villager.workplace = workplace;
  delete state.components.woodcutter[id];
  if (job === 'woodcutter') state.components.woodcutter[id] = { kind: 'idle', retryAt: 0 };
}
