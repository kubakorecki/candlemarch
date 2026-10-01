// Helping carry (spec, Logistics: Where goods are kept): a worker whose Workplace can't use them
// right now takes Hauls like a Carrier, from its own yard first, then any, and keeps its Job.
// After each Haul it goes back to work if its Workplace can use it again. Nothing is stored: a
// worker holding a Haul is helping carry (`isHelpingCarry`).
import type { Content } from '@candlemarch/content';
import type { EntityId, GameState } from '../state';
import { recipeBlockers } from '../systems/production';
import { isAtWork } from '../villagers';
import { gathererNoRoom } from '../yards';

/**
 * Whether Workplace `building` can't use its workers between tasks now: a gathering Workplace
 * whose yard is full (`gathererNoRoom`), or a workshop where no recipe can start (waiting for
 * inputs, or output full).
 */
export function cantUseWorkers(state: GameState, content: Content, building: EntityId): boolean {
  const b = state.components.building[building];
  if (!b) return false;
  const recipes = content.buildings[b.type].recipes ?? [];
  if (recipes.length === 0) return gathererNoRoom(state, content, building).length > 0;
  return recipes.every((r) => {
    const { missing, noRoom } = recipeBlockers(state, content, building, r);
    return missing.length > 0 || noRoom.length > 0;
  });
}

/**
 * Whether worker `id` is free to help carry: at work, between tasks (its task idle) with nothing
 * in hand, and its Workplace can't use it (`cantUseWorkers`). Never a Carrier.
 */
export function canHelpCarry(state: GameState, content: Content, id: EntityId): boolean {
  const { villager, woodcutter, fisher, forager, hunter, crafter } = state.components;
  const v = villager[id];
  if (!v || v.workplace === null || v.carrying || !isAtWork(v)) return false;
  const task = woodcutter[id] ?? fisher[id] ?? forager[id] ?? hunter[id] ?? crafter[id];
  return task?.kind === 'idle' && cantUseWorkers(state, content, v.workplace);
}
