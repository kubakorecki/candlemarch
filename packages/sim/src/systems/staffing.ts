// Workplaces draft idle carriers into their open positions; Masters go to a workshop of their
// trade first.
import type { Content, JobId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { isCarrierIdle } from '../logistics/jobDispatch';
import { masterWorkshop, tradeOf, waitingForMaster } from '../masters';
import type { EntityId, GameState } from '../state';
import { assignJob, isAtWork } from '../villagers';
import { dropWork, releaseWorker, vacantPositions, workersAt } from '../workers';

/**
 * The Jobs of a building's positions staffing should fill: its vacant positions, in the order its
 * content lists them, as many as its worker limit leaves room for. Empty when it's fully staffed,
 * at its limit, employs no one, or is a workshop waiting for its Master.
 */
export function openPositions(state: GameState, content: Content, building: EntityId): JobId[] {
  const b = state.components.building[building];
  if (!b || waitingForMaster(state, content, building)) return [];
  const room = b.workerLimit - workersAt(state, building).length;
  return room > 0 ? vacantPositions(state, content, building).slice(0, room) : [];
}

/**
 * Puts each Master (ID order) who is at work, holds no Haul and isn't working in a workshop of
 * their trade into the first one (`masterWorkshop`), with that position's Job. When it's full,
 * the highest-ID worker there who isn't a Master goes back to carrying to make room.
 */
function placeMasters(state: GameState, content: Content): void {
  const { master, villager, building } = state.components;
  for (const id of idsOf(master)) {
    const trade = master[id]?.trade;
    const v = villager[id];
    if (!trade || !v || !isAtWork(v) || state.logistics.hauls[id] !== undefined) continue;
    const at = v.workplace === null ? undefined : building[v.workplace];
    if (at && tradeOf(content, at.type) === trade) continue;
    const workshop = masterWorkshop(state, content, trade);
    const b = workshop === null ? undefined : building[workshop];
    if (workshop === null || !b) continue;
    const full = () =>
      vacantPositions(state, content, workshop).length === 0 ||
      workersAt(state, workshop).length >= b.workerLimit;
    if (full()) {
      const bumped = workersAt(state, workshop)
        .filter((w) => !master[w])
        .at(-1);
      if (bumped === undefined) continue;
      releaseWorker(state, content, bumped);
    }
    const job = vacantPositions(state, content, workshop)[0];
    if (job === undefined || full()) continue;
    dropWork(state, content, id);
    assignJob(state, content, id, job, workshop);
  }
}

/**
 * Places Masters (`placeMasters`), then fills open positions, buildings in ID order, each with the
 * lowest-ID idle Carrier who isn't a Master. Positions left open when no Carrier is idle are tried
 * again next tick.
 */
export function staffingSystem(state: GameState, content: Content): void {
  placeMasters(state, content);
  const { villager, master } = state.components;
  for (const building of idsOf(state.components.building)) {
    for (const job of openPositions(state, content, building)) {
      const carrier = idsOf(villager).find(
        (id) => villager[id]?.job === 'carrier' && !master[id] && isCarrierIdle(state, id),
      );
      if (carrier === undefined) return;
      assignJob(state, content, carrier, job, building);
    }
  }
}
