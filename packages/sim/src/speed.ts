// How fast a villager walks and works: the worst of its slowdowns, times the hero's aura where it
// applies. Derived from state each time it's asked; nothing is stored.
import type { Content } from '@candlemarch/content';
import { workSpeedPercent } from './aura';
import type { EntityId, GameState } from './state';

/**
 * Speed of `id` as a percentage of normal. Slowdowns don't stack: only the worst of Tired, Hungry
 * and Cold applies. Work at `workplace` is also multiplied by the
 * hero's aura there, truncated. 100 for anyone who isn't a villager, such as the hero.
 */
export function speedPercent(
  state: GameState,
  content: Content,
  id: EntityId,
  workplace: EntityId | null = null,
): number {
  const v = state.components.villager[id];
  let percent = 100;
  if (v?.tired) percent = Math.min(percent, content.needs.tired.speedPercent);
  if (v && v.missedMeals > 0) percent = Math.min(percent, content.needs.hungry.speedPercent);
  if (v && v.coldNights > 0) percent = Math.min(percent, content.needs.cold.speedPercent);
  if (workplace === null) return percent;
  return Math.trunc((percent * workSpeedPercent(state, content, workplace)) / 100);
}

/**
 * Ticks a piece of work that normally takes `ticks` takes villager `worker` at `workplace` right
 * now: scaled by 100 / `speedPercent`, truncated, and never below 1.
 */
export function workTicks(
  state: GameState,
  content: Content,
  worker: EntityId,
  workplace: EntityId,
  ticks: number,
): number {
  const percent = speedPercent(state, content, worker, workplace);
  return Math.max(1, Math.trunc((ticks * 100) / percent));
}
