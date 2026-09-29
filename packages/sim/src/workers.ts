// Worker limits, and the player taking villagers off Workplaces or moving them between them.
import type { BuildingId, Content, JobId } from '@candlemarch/content';
import { idsOf } from './entities';
import { abandonHaul } from './logistics/jobDispatch';
import type { EntityId, GameState } from './state';
import { stopAtNextTile } from './systems/movement';
import { assignJob } from './villagers';

/** Every position a building of `type` has: the highest its worker limit goes. */
export function maxWorkers(content: Content, type: BuildingId): number {
  return content.buildings[type].employs.reduce((total, slot) => total + slot.count, 0);
}

/** Villagers working at `building`, in ID order. */
export function workersAt(state: GameState, building: EntityId): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.workplace === building);
}

/**
 * The Jobs of a building's positions nobody fills, whatever its worker limit: one entry per
 * missing worker, in the order its content lists them. Empty when it employs no one.
 */
export function vacantPositions(state: GameState, content: Content, building: EntityId): JobId[] {
  const b = state.components.building[building];
  if (!b) return [];
  const { villager } = state.components;
  const vacant: JobId[] = [];
  for (const slot of content.buildings[b.type].employs) {
    let filled = 0;
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v?.workplace === building && v.job === slot.job) filled += 1;
    }
    for (let i = filled; i < slot.count; i++) vacant.push(slot.job);
  }
  return vacant;
}

/**
 * Workplaces villager `id` can be reassigned to: every building but its own with a vacant
 * position, in ID order.
 */
export function reassignTargets(state: GameState, content: Content, id: EntityId): EntityId[] {
  const v = state.components.villager[id];
  if (!v) return [];
  return idsOf(state.components.building).filter(
    (b) => b !== v.workplace && vacantPositions(state, content, b).length > 0,
  );
}

/**
 * Villager `id` puts down its work in hand and stops at the next tile, keeping its Job: nothing in
 * hand is lost. Goods, and a hunter's bag, go to its Workplace's output buffer, even if that
 * overfills it, and a batch under way puts its inputs back in the input buffer. A chop, catch or
 * hunt under way is abandoned, and its task starts again from idle. A Carrier drops its haul (see
 * `abandonHaul`). Unassigning uses it, and so does a villager a Gloamling reaches.
 */
export function dropWork(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  abandonHaul(state, id);
  const workplace = v.workplace === null ? undefined : state.components.building[v.workplace];
  const batch = state.components.crafter[id];
  if (workplace && batch?.kind === 'working') {
    for (const i of content.recipes[batch.recipe].inputs) {
      workplace.input[i.resource] = (workplace.input[i.resource] ?? 0) + i.amount;
    }
  }
  const hunt = state.components.hunter[id];
  if (workplace && hunt?.kind === 'toLodge') {
    for (const c of hunt.bag)
      workplace.stock[c.resource] = (workplace.stock[c.resource] ?? 0) + c.amount;
  }
  if (workplace && v.carrying) {
    const { resource, amount } = v.carrying;
    workplace.stock[resource] = (workplace.stock[resource] ?? 0) + amount;
  }
  v.carrying = null;
  stopAtNextTile(state, id);
  assignJob(state, content, id, v.job, v.workplace);
}

/**
 * Makes villager `id` a Carrier with no Workplace, from where it stands, once it has dropped its
 * work (`dropWork`). Leaves worker limits alone.
 */
function release(state: GameState, content: Content, id: EntityId): void {
  dropWork(state, content, id);
  assignJob(state, content, id, 'carrier', null);
}

/** Makes every worker at `building` a Carrier, from where it stands. Leaves worker limits alone. */
export function releaseWorkers(state: GameState, content: Content, building: EntityId): void {
  for (const id of workersAt(state, building)) release(state, content, id);
}

/** Lowers `building`'s worker limit by one, so staffing doesn't fill the position just left. */
function lowerLimit(state: GameState, building: EntityId | null): void {
  const b = building === null ? undefined : state.components.building[building];
  if (b) b.workerLimit = Math.max(0, b.workerLimit - 1);
}

/** Takes villager `id` off its Workplace, making it a Carrier. Ignored for Carriers. */
export function unassignWorker(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v || v.workplace === null) return;
  const old = v.workplace;
  release(state, content, id);
  lowerLimit(state, old);
}

/**
 * Moves villager `id`, a worker or a Carrier, to the first vacant position at `workplace`, with
 * that position's Job. The old Workplace's limit drops by one, so the position moves with the
 * person; the new one's rises by one if it must to fit them. Ignored unless `workplace` is
 * another building with a vacant position.
 */
export function reassignWorker(
  state: GameState,
  content: Content,
  id: EntityId,
  workplace: EntityId,
): void {
  const v = state.components.villager[id];
  const target = state.components.building[workplace];
  if (!v || !target || v.workplace === workplace) return;
  const job = vacantPositions(state, content, workplace)[0];
  if (job === undefined) return;
  const old = v.workplace;
  release(state, content, id);
  lowerLimit(state, old);
  if (workersAt(state, workplace).length >= target.workerLimit) target.workerLimit += 1;
  assignJob(state, content, id, job, workplace);
}

/**
 * Sets `building`'s worker limit. Below the number employed, the highest-ID workers are
 * unassigned until it fits. Ignored unless `limit` is a whole number from 0 to `maxWorkers`.
 */
export function setWorkerLimit(
  state: GameState,
  content: Content,
  building: EntityId,
  limit: number,
): void {
  const b = state.components.building[building];
  if (!b || !Number.isInteger(limit) || limit < 0 || limit > maxWorkers(content, b.type)) return;
  b.workerLimit = limit;
  for (const id of workersAt(state, building).slice(limit).reverse()) {
    release(state, content, id);
  }
}
