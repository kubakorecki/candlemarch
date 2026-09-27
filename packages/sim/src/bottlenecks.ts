// Why a Workplace stands idle, for the icons over it (spec, Logistics: "Making bottlenecks
// readable"). Derived each time it's asked, never stored.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';
import { isPaused, recipeBlockers } from './systems/production';
import { openPositions } from './systems/staffing';

export type WorkplaceStatus =
  /** A position staffing would fill is empty (within the worker limit). */
  | { kind: 'noWorker' }
  /** A workshop lacks these inputs for its first recipe (none has all its inputs). */
  | { kind: 'waitingFor'; resources: ResourceId[] }
  /** A workshop has a recipe's inputs, but its output buffer has no room for these outputs. */
  | { kind: 'outputFull'; resources: ResourceId[] };

/**
 * Why Workplace `building` is idle, or null when it isn't (or is idle on purpose: paused at its
 * stock target). "Waiting for" and "output full" apply to workshops (buildings with recipes).
 */
export function workplaceStatus(
  state: GameState,
  content: Content,
  building: EntityId,
): WorkplaceStatus | null {
  const b = state.components.building[building];
  if (!b) return null;
  if (openPositions(state, content, building).length > 0) return { kind: 'noWorker' };
  const recipes = content.buildings[b.type].recipes ?? [];
  if (recipes.length === 0 || isPaused(state, content, building)) return null;
  const { crafter, villager } = state.components;
  const working = idsOf(crafter).some(
    (id) => crafter[id]?.kind === 'working' && villager[id]?.workplace === building,
  );
  if (working) return null;

  const blockers = recipes.map((r) => recipeBlockers(state, content, building, r));
  if (blockers.some((r) => r.missing.length === 0 && r.noRoom.length === 0)) return null;
  const stuck = blockers.find((r) => r.missing.length === 0);
  if (stuck) return { kind: 'outputFull', resources: stuck.noRoom };
  return { kind: 'waitingFor', resources: blockers[0]?.missing ?? [] };
}
