// Why a Workplace stands idle, for the icons over it (spec, Logistics: "Making bottlenecks
// readable"). Derived each time it's asked, never stored.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import { lodgeGrounds } from './huntingGrounds';
import { isPaused } from './standingOrders';
import type { EntityId, GameState } from './state';
import { recipeBlockers } from './systems/production';
import { openPositions } from './systems/staffing';
import { gathererNoRoom } from './yards';

export type WorkplaceStatus =
  /** A position staffing would fill is empty (within the worker limit). */
  | { kind: 'noWorker' }
  /** A workshop lacks these inputs for its first recipe (none has all its inputs). */
  | { kind: 'waitingFor'; resources: ResourceId[] }
  /**
   * A workshop has a recipe's inputs, but its output buffer has no room for these outputs; or a
   * gathering Workplace has no room for what it brings back.
   */
  | { kind: 'outputFull'; resources: ResourceId[] }
  /** A hunter's lodge whose grounds (its chosen one, else all in reach) have no Game. */
  | { kind: 'noGame' };

/**
 * Why Workplace `building` is idle, or null when it isn't (or is idle on purpose: paused at its
 * standing order). "Waiting for" applies to workshops (buildings with recipes), "output full" to
 * workshops and gathering Workplaces (`gathererNoRoom`), "no Game" to hunter's lodges.
 */
export function workplaceStatus(
  state: GameState,
  content: Content,
  building: EntityId,
): WorkplaceStatus | null {
  const b = state.components.building[building];
  if (!b) return null;
  if (openPositions(state, content, building).length > 0) return { kind: 'noWorker' };
  if (isPaused(state, content, building)) return null;
  const recipes = content.buildings[b.type].recipes ?? [];
  if (recipes.length === 0) {
    const noRoom = gathererNoRoom(state, content, building);
    if (noRoom.length > 0) return { kind: 'outputFull', resources: noRoom };
    return outOfGame(state, content, building) ? { kind: 'noGame' } : null;
  }
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

/** Whether building `id` hunts, and no ground it hunts (`lodgeGrounds`) has Game. */
function outOfGame(state: GameState, content: Content, id: EntityId): boolean {
  const b = state.components.building[id];
  if (!b || !content.buildings[b.type].hunts) return false;
  const { huntingGround } = state.components;
  return !lodgeGrounds(state, content, id).some((g) => (huntingGround[g]?.game ?? 0) > 0);
}
