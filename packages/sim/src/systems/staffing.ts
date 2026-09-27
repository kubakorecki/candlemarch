// Workplaces draft idle carriers into their open positions.
import type { Content, JobId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { isCarrierIdle } from '../logistics/jobDispatch';
import type { EntityId, GameState } from '../state';
import { assignJob } from '../villagers';

/**
 * The Jobs of a building's unfilled positions, one entry per missing worker, in the order its
 * content lists them. Empty when it's fully staffed or employs no one.
 */
export function openPositions(state: GameState, content: Content, building: EntityId): JobId[] {
  const b = state.components.building[building];
  if (!b) return [];
  const { villager } = state.components;
  const open: JobId[] = [];
  for (const slot of content.buildings[b.type].employs) {
    let filled = 0;
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v?.workplace === building && v.job === slot.job) filled += 1;
    }
    for (let i = filled; i < slot.count; i++) open.push(slot.job);
  }
  return open;
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
