// Workplaces draft idle carriers into their open positions.
import type { Content, JobId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { isCarrierIdle } from '../logistics/jobDispatch';
import type { EntityId, GameState } from '../state';
import { assignJob } from '../villagers';
import { vacantPositions, workersAt } from '../workers';

/**
 * The Jobs of a building's positions staffing should fill: its vacant positions, in the order its
 * content lists them, as many as its worker limit leaves room for. Empty when it's fully staffed,
 * at its limit, or employs no one.
 */
export function openPositions(state: GameState, content: Content, building: EntityId): JobId[] {
  const b = state.components.building[building];
  if (!b) return [];
  const room = b.workerLimit - workersAt(state, building).length;
  return room > 0 ? vacantPositions(state, content, building).slice(0, room) : [];
}

/**
 * Fills open positions, buildings in ID order, each with the lowest-ID idle Carrier. Positions
 * left open when no Carrier is idle are tried again next tick.
 */
export function staffingSystem(state: GameState, content: Content): void {
  const { villager } = state.components;
  for (const building of idsOf(state.components.building)) {
    for (const job of openPositions(state, content, building)) {
      const carrier = idsOf(villager).find(
        (id) => villager[id]?.job === 'carrier' && isCarrierIdle(state, id),
      );
      if (carrier === undefined) return;
      assignJob(state, content, carrier, job, building);
    }
  }
}
