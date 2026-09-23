// Logistics model A: a dispatcher hands each idle carrier one haul (pick up at A, drop at B).
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { blockedGrid, entityDoor, tileIndex } from '../grid';
import { findPath, type Grid, tileDistance } from '../pathfinding';
import type { EntityId, GameState, Store } from '../state';
import { isAt, stopAtNextTile, villagerTile, walkTo } from '../systems/movement';
import type { LogisticsModel } from './model';
import { listDemands, listSupplies } from './supplyDemand';

export interface HaulJob {
  resource: ResourceId;
  /** Units this job moves. Counts as reserved at `from` until picked up, and incoming at `to` until delivered. */
  amount: number;
  /** Building to pick up from. */
  from: EntityId;
  /** Construction site to deliver to. */
  to: EntityId;
  /** `pickup`: walking to `from`. `dropoff`: carrying to `to`. `return`: carrying back to `from` because `to` is gone. */
  phase: 'pickup' | 'dropoff' | 'return';
}

export interface JobDispatchState {
  model: 'jobDispatch';
  /** Current job per carrier, keyed by the carrier's entity ID. */
  jobs: Store<HaulJob>;
}

export function initJobDispatch(): JobDispatchState {
  return { model: 'jobDispatch', jobs: {} };
}

function carrierIds(state: GameState): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.role === 'carrier');
}

/** Units of `resource` at `building` already promised to jobs that haven't picked up yet. */
function reserved(jobs: Store<HaulJob>, building: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const job of Object.values(jobs)) {
    if (job.from === building && job.resource === resource && job.phase === 'pickup') {
      total += job.amount;
    }
  }
  return total;
}

/** Units of `resource` on their way to `site`. */
function incoming(jobs: Store<HaulJob>, site: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const job of Object.values(jobs)) {
    if (job.to === site && job.resource === resource && job.phase !== 'return') total += job.amount;
  }
  return total;
}

/** Advances one carrier's job by one tick. */
function advanceJob(state: GameState, content: Content, id: EntityId, job: HaulJob): void {
  const { jobs } = state.logistics;
  const { building, site, villager, path } = state.components;
  const carrier = villager[id];
  if (!carrier) {
    delete jobs[id];
    return;
  }
  const fromDoor = entityDoor(state, content, job.from);
  const toDoor = entityDoor(state, content, job.to);

  // The site was cancelled: abandon the pickup, or bring the goods back.
  if (!site[job.to] && job.phase !== 'return') {
    stopAtNextTile(state, id);
    if (job.phase === 'pickup') delete jobs[id];
    else job.phase = 'return';
    return;
  }
  // The source is gone: there's nothing to pick up, and nowhere to return goods to.
  if (!building[job.from] || !fromDoor) {
    stopAtNextTile(state, id);
    if (job.phase !== 'dropoff') {
      carrier.carrying = null;
      delete jobs[id];
    }
    return;
  }
  if (path[id]) return; // still walking

  switch (job.phase) {
    case 'pickup': {
      if (!isAt(state, id, fromDoor)) {
        if (!walkTo(state, content, id, [fromDoor])) delete jobs[id];
        return;
      }
      const source = building[job.from];
      const available = source?.stock[job.resource] ?? 0;
      const amount = Math.min(job.amount, available);
      if (!source || amount <= 0) {
        delete jobs[id];
        return;
      }
      source.stock[job.resource] = available - amount;
      carrier.carrying = { resource: job.resource, amount };
      job.amount = amount;
      job.phase = 'dropoff';
      if (toDoor) walkTo(state, content, id, [toDoor]);
      return;
    }
    case 'dropoff': {
      if (!toDoor) return;
      if (!isAt(state, id, toDoor)) {
        if (!walkTo(state, content, id, [toDoor])) job.phase = 'return';
        return;
      }
      const target = site[job.to];
      if (target && carrier.carrying) {
        target.delivered[job.resource] = (target.delivered[job.resource] ?? 0) + job.amount;
      }
      carrier.carrying = null;
      delete jobs[id];
      return;
    }
    case 'return': {
      if (!isAt(state, id, fromDoor)) {
        if (!walkTo(state, content, id, [fromDoor])) {
          carrier.carrying = null; // can't get back: drop the goods
          delete jobs[id];
        }
        return;
      }
      // Returned goods go back into the buffer even if it is full: capacity limits producers.
      const source = building[job.from];
      if (source && carrier.carrying) {
        source.stock[job.resource] = (source.stock[job.resource] ?? 0) + carrier.carrying.amount;
      }
      carrier.carrying = null;
      delete jobs[id];
      return;
    }
  }
}

/** Gives an idle carrier the oldest unmet demand, served from the nearest source with stock. */
function dispatch(state: GameState, content: Content, id: EntityId): void {
  const { jobs } = state.logistics;
  const { map } = state;
  const carrier = state.components.villager[id];
  const here = villagerTile(state, id);
  if (!carrier || !here) return;
  const capacity = content.villagerRoles[carrier.role].carryCapacity;
  const hereIndex = tileIndex(map, here.x, here.y);
  const supplies = listSupplies(state, content);
  let grid: Grid | null = null;

  for (const demand of listDemands(state, content)) {
    const need = demand.amount - incoming(jobs, demand.site, demand.resource);
    const siteDoor = entityDoor(state, content, demand.site);
    if (need <= 0 || !siteDoor) continue;

    const sources = supplies
      .flatMap((s) => {
        const available = s.amount - reserved(jobs, s.building, s.resource);
        const door = entityDoor(state, content, s.building);
        if (s.resource !== demand.resource || available <= 0 || !door) return [];
        const distance = tileDistance(map.width, hereIndex, tileIndex(map, door.x, door.y));
        return [{ building: s.building, available, door, distance }];
      })
      .sort((a, b) => a.distance - b.distance || a.building - b.building);

    for (const source of sources) {
      const { door } = source;
      // Only take a job whose drop-off is reachable from the pickup.
      grid ??= { width: map.width, height: map.height, blocked: blockedGrid(state, content) };
      const leg = findPath(grid, tileIndex(map, door.x, door.y), [
        tileIndex(map, siteDoor.x, siteDoor.y),
      ]);
      if (leg === null || !walkTo(state, content, id, [door])) continue;
      jobs[id] = {
        resource: demand.resource,
        amount: Math.min(capacity, source.available, need),
        from: source.building,
        to: demand.site,
        phase: 'pickup',
      };
      return;
    }
  }
}

export const jobDispatch: LogisticsModel = {
  init: initJobDispatch,
  update(state, content) {
    const { jobs } = state.logistics;
    for (const id of carrierIds(state)) {
      const job = jobs[id];
      if (job) advanceJob(state, content, id, job);
      // A carrier freed this tick waits until the next one; this keeps each step simple.
      else if (!state.components.path[id]) dispatch(state, content, id);
    }
  },
};
