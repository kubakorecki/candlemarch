// Villagers: naming them, and giving them a Job, a Workplace and that Job's task state.
import type { Content, JobId } from '@candlemarch/content';
import { randomInt } from './rng';
import type { EntityId, GameState } from './state';

/**
 * Draws a name for a new villager with the state's PRNG: one no living villager has, while any
 * are left, else any name from the pool. Candidates keep content order, so a seed always gives
 * the same names.
 */
export function drawVillagerName(state: GameState, content: Content): string {
  const pool = content.villagerNames;
  const taken = new Set(Object.values(state.components.villager).map((v) => v.name));
  const unused = pool.filter((name) => !taken.has(name));
  const candidates = unused.length > 0 ? unused : pool;
  const name = candidates[randomInt(state, candidates.length)];
  if (name === undefined) throw new Error('content has no villager names');
  return name;
}

/** The name a villager saved before names existed gets on load: the pool, in ID order. */
export function fallbackVillagerName(id: EntityId, content: Content): string {
  const pool = content.villagerNames;
  const name = pool[(id - 1) % pool.length];
  if (name === undefined) throw new Error('content has no villager names');
  return name;
}

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
