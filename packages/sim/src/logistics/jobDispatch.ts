// Logistics model A: a dispatcher hands each idle carrier one haul (pick up at A, drop at B).
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { blockedGrid, entityDoor, tileIndex } from '../grid';
import { findPath, type Grid, tileDistance } from '../pathfinding';
import type { EntityId, GameState, Store } from '../state';
import { isAt, stopAtNextTile, villagerTile, walkTo } from '../systems/movement';
import type { LogisticsModel } from './model';
import { listDemands, listSupplies } from './supplyDemand';

export interface Haul {
  resource: ResourceId;
  /** Units this haul moves. Counts as reserved at `from` until picked up, and incoming at `to` until delivered. */
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
  /** Current haul per carrier, keyed by the carrier's entity ID. */
  hauls: Store<Haul>;
}

export function initJobDispatch(): JobDispatchState {
  return { model: 'jobDispatch', hauls: {} };
}

function carrierIds(state: GameState): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.job === 'carrier');
}

/** Units of `resource` at `building` already promised to hauls that haven't picked up yet. */
function reserved(hauls: Store<Haul>, building: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.from === building && haul.resource === resource && haul.phase === 'pickup') {
      total += haul.amount;
    }
  }
  return total;
}

/** Units of `resource` on their way to `site`. */
function incoming(hauls: Store<Haul>, site: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.to === site && haul.resource === resource && haul.phase !== 'return')
      total += haul.amount;
  }
  return total;
}

/** Advances one carrier's haul by one tick. */
function advanceHaul(state: GameState, content: Content, id: EntityId, haul: Haul): void {
  const { hauls } = state.logistics;
  const { building, site, villager, path } = state.components;
  const carrier = villager[id];
  if (!carrier) {
    delete hauls[id];
    return;
  }
  const fromDoor = entityDoor(state, content, haul.from);
  const toDoor = entityDoor(state, content, haul.to);

  // The site was cancelled: abandon the pickup, or bring the goods back.
  if (!site[haul.to] && haul.phase !== 'return') {
    stopAtNextTile(state, id);
    if (haul.phase === 'pickup') delete hauls[id];
    else haul.phase = 'return';
    return;
  }
  // The source is gone: there's nothing to pick up, and nowhere to return goods to.
  if (!building[haul.from] || !fromDoor) {
    stopAtNextTile(state, id);
    if (haul.phase !== 'dropoff') {
      carrier.carrying = null;
      delete hauls[id];
    }
    return;
  }
  if (path[id]) return; // still walking

  switch (haul.phase) {
    case 'pickup': {
      if (!isAt(state, id, fromDoor)) {
        if (!walkTo(state, content, id, [fromDoor])) delete hauls[id];
        return;
      }
      const source = building[haul.from];
      const available = source?.stock[haul.resource] ?? 0;
      const amount = Math.min(haul.amount, available);
      if (!source || amount <= 0) {
        delete hauls[id];
        return;
      }
      source.stock[haul.resource] = available - amount;
      carrier.carrying = { resource: haul.resource, amount };
      haul.amount = amount;
      haul.phase = 'dropoff';
      if (toDoor) walkTo(state, content, id, [toDoor]);
      return;
    }
    case 'dropoff': {
      if (!toDoor) return;
      if (!isAt(state, id, toDoor)) {
        if (!walkTo(state, content, id, [toDoor])) haul.phase = 'return';
        return;
      }
      const target = site[haul.to];
      if (target && carrier.carrying) {
        target.delivered[haul.resource] = (target.delivered[haul.resource] ?? 0) + haul.amount;
      }
      carrier.carrying = null;
      delete hauls[id];
      return;
    }
    case 'return': {
      if (!isAt(state, id, fromDoor)) {
        if (!walkTo(state, content, id, [fromDoor])) {
          carrier.carrying = null; // can't get back: drop the goods
          delete hauls[id];
        }
        return;
      }
      // Returned goods go back into the buffer even if it is full: capacity limits producers.
      const source = building[haul.from];
      if (source && carrier.carrying) {
        source.stock[haul.resource] = (source.stock[haul.resource] ?? 0) + carrier.carrying.amount;
      }
      carrier.carrying = null;
      delete hauls[id];
      return;
    }
  }
}

/** Gives an idle carrier the oldest unmet demand, served from the nearest source with stock. */
function dispatch(state: GameState, content: Content, id: EntityId): void {
  const { hauls } = state.logistics;
  const { map } = state;
  const carrier = state.components.villager[id];
  const here = villagerTile(state, id);
  if (!carrier || !here) return;
  const capacity = content.jobs[carrier.job].carryCapacity;
  const hereIndex = tileIndex(map, here.x, here.y);
  const supplies = listSupplies(state, content);
  let grid: Grid | null = null;

  for (const demand of listDemands(state, content)) {
    const need = demand.amount - incoming(hauls, demand.site, demand.resource);
    const siteDoor = entityDoor(state, content, demand.site);
    if (need <= 0 || !siteDoor) continue;

    const sources = supplies
      .flatMap((s) => {
        const available = s.amount - reserved(hauls, s.building, s.resource);
        const door = entityDoor(state, content, s.building);
        if (s.resource !== demand.resource || available <= 0 || !door) return [];
        const distance = tileDistance(map.width, hereIndex, tileIndex(map, door.x, door.y));
        return [{ building: s.building, available, door, distance }];
      })
      .sort((a, b) => a.distance - b.distance || a.building - b.building);

    for (const source of sources) {
      const { door } = source;
      // Only take a haul whose drop-off is reachable from the pickup.
      grid ??= { width: map.width, height: map.height, blocked: blockedGrid(state, content) };
      const leg = findPath(grid, tileIndex(map, door.x, door.y), [
        tileIndex(map, siteDoor.x, siteDoor.y),
      ]);
      if (leg === null || !walkTo(state, content, id, [door])) continue;
      hauls[id] = {
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
    const { hauls } = state.logistics;
    for (const id of carrierIds(state)) {
      const haul = hauls[id];
      if (haul) advanceHaul(state, content, id, haul);
      // A carrier freed this tick waits until the next one; this keeps each step simple.
      else if (!state.components.path[id]) dispatch(state, content, id);
    }
  },
};
