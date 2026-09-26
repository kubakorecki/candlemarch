// Logistics model A: a dispatcher hands each idle carrier one haul (pick up at A, drop at B).
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { entityDoor, stockpileTileIndices, tileAt, tileIndex } from '../grid';
import { tileDistance, travelCosts } from '../pathfinding';
import type { EntityId, GameState, Store, Tile } from '../state';
import { addToTile, amountOnTile, roomOnTile, takeFromTile } from '../stockpiles';
import { isAt, stopAtNextTile, villagerTile, walkGrid, walkTo } from '../systems/movement';
import type { LogisticsModel } from './model';
import {
  canServe,
  type Demand,
  demandGroups,
  listDemands,
  listSupplies,
  type Supply,
} from './supplyDemand';

export interface Haul {
  resource: ResourceId;
  /** Units this haul moves. Counts as reserved at `from` until picked up, and incoming at `to` until delivered. */
  amount: number;
  /** Building or stockpile to pick up from. */
  from: EntityId;
  /** Construction site or stockpile to deliver to. */
  to: EntityId;
  /** Stockpile tile (map tile index) to pick up from. Absent when `from` is a building. */
  fromTile?: number;
  /** Stockpile tile (map tile index) to deliver to. Absent when `to` is a site. */
  toTile?: number;
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

/** Current hauls, keyed by carrier. Empty when the game uses another logistics model. */
export function haulsOf(state: GameState): Store<Haul> {
  return state.logistics.model === 'jobDispatch' ? state.logistics.hauls : {};
}

function carrierIds(state: GameState): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.job === 'carrier');
}

/** Units of `resource` at `source` already promised to hauls that haven't picked up yet. */
function reserved(hauls: Store<Haul>, source: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.from === source && haul.resource === resource && haul.phase === 'pickup') {
      total += haul.amount;
    }
  }
  return total;
}

/** Units of `resource` on their way to `target`. */
function incoming(hauls: Store<Haul>, target: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.to === target && haul.resource === resource && haul.phase !== 'return')
      total += haul.amount;
  }
  return total;
}

/** Units on stockpile tile `index` promised to hauls that haven't picked up yet. */
function reservedOnTile(hauls: Store<Haul>, index: number): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.fromTile === index && haul.phase === 'pickup') total += haul.amount;
  }
  return total;
}

/**
 * Units of `resource` stockpile tile `index` can still take once hauls on their way there
 * arrive, including goods being returned to it. 0 if any of them brings another resource,
 * since a tile holds one resource.
 */
function freeRoomOnTile(
  state: GameState,
  content: Content,
  pile: EntityId,
  index: number,
  resource: ResourceId,
): number {
  const stockpile = state.components.stockpile[pile];
  if (!stockpile) return 0;
  let room = roomOnTile(stockpile, index, resource, content.logistics.stockpileTileCapacity);
  for (const haul of Object.values(haulsOf(state))) {
    const bound =
      haul.phase === 'return'
        ? haul.from === pile && haul.fromTile === index
        : haul.to === pile && haul.toTile === index;
    if (!bound) continue;
    if (haul.resource !== resource) return 0;
    room -= haul.amount;
  }
  return Math.max(0, room);
}

/**
 * The tile of `tiles` nearest to tile `near` whose `amountAt` is positive, ties to the lowest
 * tile index; or null if there's none.
 */
function nearestTile(
  width: number,
  tiles: readonly number[],
  near: number,
  amountAt: (index: number) => number,
): { tile: number; amount: number } | null {
  let best: { tile: number; amount: number; distance: number } | null = null;
  for (const tile of [...tiles].sort((a, b) => a - b)) {
    const amount = amountAt(tile);
    if (amount <= 0) continue;
    const distance = tileDistance(width, near, tile);
    if (!best || distance < best.distance) best = { tile, amount, distance };
  }
  return best && { tile: best.tile, amount: best.amount };
}

/** Where a haul picks up, and how many units are free to take there. */
interface Pickup {
  tile: number;
  /** The tile is a stockpile tile, not a door. */
  onStockpile: boolean;
  available: number;
}

/**
 * Where to pick up from `supply`: the building's door, or the stockpile tile nearest to tile
 * `near` holding unreserved goods. Null if nothing is free to take.
 */
function pickupFor(
  state: GameState,
  content: Content,
  supply: Supply,
  near: number,
): Pickup | null {
  const hauls = haulsOf(state);
  const { map } = state;
  if (supply.kind === 'building') {
    const door = entityDoor(state, content, supply.source);
    const available = supply.amount - reserved(hauls, supply.source, supply.resource);
    if (!door || available <= 0) return null;
    return { tile: tileIndex(map, door.x, door.y), onStockpile: false, available };
  }
  const pile = state.components.stockpile[supply.source];
  if (!pile) return null;
  const tiles = stockpileTileIndices(state, supply.source);
  const found = nearestTile(
    map.width,
    tiles,
    near,
    (i) => amountOnTile(pile, i, supply.resource) - reservedOnTile(hauls, i),
  );
  return found && { tile: found.tile, onStockpile: true, available: found.amount };
}

/** Where a haul drops off, and how many units fit there. */
interface Dropoff {
  tile: number;
  /** The tile is a stockpile tile, not a door. */
  onStockpile: boolean;
  room: number;
}

/**
 * Where to drop goods for `demand`: the site's door, or the stockpile tile nearest to tile
 * `near` with room. Null if there's nowhere to put them.
 */
function dropoffFor(
  state: GameState,
  content: Content,
  demand: Demand,
  near: number,
): Dropoff | null {
  const { map } = state;
  if (demand.kind === 'site') {
    const door = entityDoor(state, content, demand.target);
    if (!door) return null;
    return { tile: tileIndex(map, door.x, door.y), onStockpile: false, room: demand.amount };
  }
  const tiles = stockpileTileIndices(state, demand.target);
  const found = nearestTile(map.width, tiles, near, (i) =>
    freeRoomOnTile(state, content, demand.target, i, demand.resource),
  );
  return found && { tile: found.tile, onStockpile: true, room: found.amount };
}

/** Tile a haul walks to at one end: the stockpile tile if it has one, otherwise the door. */
function endTile(
  state: GameState,
  content: Content,
  entity: EntityId,
  stockpileTile: number | undefined,
): Tile | null {
  if (stockpileTile !== undefined) return tileAt(state.map, stockpileTile);
  return entityDoor(state, content, entity);
}

/** Advances one carrier's haul by one tick. */
function advanceHaul(state: GameState, content: Content, id: EntityId, haul: Haul): void {
  const hauls = haulsOf(state);
  const { building, site, stockpile, villager, path } = state.components;
  const carrier = villager[id];
  if (!carrier) {
    delete hauls[id];
    return;
  }

  // The site was cancelled or the stockpile removed: abandon the pickup, or bring the goods back.
  if (!site[haul.to] && !stockpile[haul.to] && haul.phase !== 'return') {
    stopAtNextTile(state, id);
    if (haul.phase === 'pickup') delete hauls[id];
    else haul.phase = 'return';
    return;
  }
  // The source is gone: there's nothing to pick up, and nowhere to return goods to.
  if (!building[haul.from] && !stockpile[haul.from] && haul.phase !== 'dropoff') {
    stopAtNextTile(state, id);
    carrier.carrying = null;
    delete hauls[id];
    return;
  }
  if (path[id]) return; // still walking

  switch (haul.phase) {
    case 'pickup': {
      const at = endTile(state, content, haul.from, haul.fromTile);
      if (!at) return;
      if (!isAt(state, id, at)) {
        if (!walkTo(state, content, id, [at])) delete hauls[id];
        return;
      }
      const amount = take(state, haul);
      if (amount <= 0) {
        delete hauls[id];
        return;
      }
      carrier.carrying = { resource: haul.resource, amount };
      haul.amount = amount;
      haul.phase = 'dropoff';
      const to = endTile(state, content, haul.to, haul.toTile);
      if (to) walkTo(state, content, id, [to]);
      return;
    }
    case 'dropoff': {
      const at = endTile(state, content, haul.to, haul.toTile);
      if (!at) return;
      if (!isAt(state, id, at)) {
        if (!walkTo(state, content, id, [at])) haul.phase = 'return';
        return;
      }
      const target = site[haul.to];
      const pile = stockpile[haul.to];
      if (carrier.carrying && target) {
        target.delivered[haul.resource] = (target.delivered[haul.resource] ?? 0) + haul.amount;
      } else if (carrier.carrying && pile && haul.toTile !== undefined) {
        if (!addToTile(pile, haul.toTile, carrier.carrying)) {
          haul.phase = 'return'; // the tile holds something else now
          return;
        }
      }
      carrier.carrying = null;
      delete hauls[id];
      return;
    }
    case 'return': {
      const at = endTile(state, content, haul.from, haul.fromTile);
      if (!at) return;
      if (!isAt(state, id, at)) {
        if (!walkTo(state, content, id, [at])) {
          carrier.carrying = null; // can't get back: drop the goods
          delete hauls[id];
        }
        return;
      }
      // Returned goods go back even if that overfills: capacity limits new hauls, not returns.
      // A stockpile tile that holds another resource by now can't take them, and they're lost.
      const source = building[haul.from];
      const pile = stockpile[haul.from];
      if (carrier.carrying && source) {
        source.stock[haul.resource] = (source.stock[haul.resource] ?? 0) + carrier.carrying.amount;
      } else if (carrier.carrying && pile && haul.fromTile !== undefined) {
        addToTile(pile, haul.fromTile, carrier.carrying);
      }
      carrier.carrying = null;
      delete hauls[id];
      return;
    }
  }
}

/** Takes up to `haul.amount` of its resource from its source. Returns how many were taken. */
function take(state: GameState, haul: Haul): number {
  const source = state.components.building[haul.from];
  if (source) {
    const available = source.stock[haul.resource] ?? 0;
    const amount = Math.min(haul.amount, available);
    if (amount <= 0) return 0;
    source.stock[haul.resource] = available - amount;
    return amount;
  }
  const pile = state.components.stockpile[haul.from];
  if (!pile || haul.fromTile === undefined) return 0;
  return takeFromTile(pile, haul.fromTile, haul.resource, haul.amount);
}

/**
 * Gives an idle carrier the first unmet demand group (sites one by one, then stockpiles by
 * priority), served from the source quickest to walk to with goods free to take. Among a group's
 * demands the carrier takes the one quickest to walk to from the pickup, roads included, so
 * goods go to the nearest stockpile with room.
 */
function dispatch(state: GameState, content: Content, id: EntityId): void {
  const hauls = haulsOf(state);
  const { map } = state;
  const carrier = state.components.villager[id];
  const here = villagerTile(state, id);
  if (!carrier || !here) return;
  const capacity = content.jobs[carrier.job].carryCapacity;
  const hereIndex = tileIndex(map, here.x, here.y);
  const supplies = listSupplies(state, content);
  const grid = walkGrid(state, content);
  const fromHere = travelCosts(grid, hereIndex);
  // Walking costs from each pickup tile, computed when first needed.
  const fromPickup: Record<number, Float64Array> = {};

  for (const group of demandGroups(state, listDemands(state, content))) {
    const open = group.flatMap((demand) => {
      const need = demand.amount - incoming(hauls, demand.target, demand.resource);
      return need > 0 ? [{ demand, need }] : [];
    });
    const first = open[0];
    if (!first) continue;

    // Every demand in a group takes the same resource from the same kinds of source.
    const sources = supplies
      .filter((s) => canServe(s, first.demand))
      .flatMap((s) => {
        const pickup = pickupFor(state, content, s, hereIndex);
        if (!pickup) return [];
        const cost = fromHere[pickup.tile] as number;
        return cost === Number.POSITIVE_INFINITY ? [] : [{ source: s.source, pickup, cost }];
      })
      .sort((a, b) => a.cost - b.cost || a.source - b.source);

    for (const { source, pickup } of sources) {
      fromPickup[pickup.tile] ??= travelCosts(grid, pickup.tile);
      const costs = fromPickup[pickup.tile] as Float64Array;
      const dropoffs = open
        .flatMap(({ demand, need }) => {
          const dropoff = dropoffFor(state, content, demand, pickup.tile);
          if (!dropoff) return [];
          const cost = costs[dropoff.tile] as number;
          // Only take a haul whose drop-off is reachable from the pickup.
          return cost === Number.POSITIVE_INFINITY ? [] : [{ demand, need, dropoff, cost }];
        })
        // A stable sort, so ties go to the earlier demand.
        .sort((a, b) => a.cost - b.cost);

      const best = dropoffs[0];
      if (!best) continue;
      if (!walkTo(state, content, id, [tileAt(map, pickup.tile)])) continue;
      const { demand, need, dropoff } = best;
      const haul: Haul = {
        resource: demand.resource,
        amount: Math.min(capacity, pickup.available, need, dropoff.room),
        from: source,
        to: demand.target,
        phase: 'pickup',
      };
      if (pickup.onStockpile) haul.fromTile = pickup.tile;
      if (dropoff.onStockpile) haul.toTile = dropoff.tile;
      hauls[id] = haul;
      return;
    }
  }
}

export const jobDispatch: LogisticsModel = {
  init: initJobDispatch,
  update(state, content) {
    const hauls = haulsOf(state);
    for (const id of carrierIds(state)) {
      const haul = hauls[id];
      if (haul) advanceHaul(state, content, id, haul);
      // A carrier freed this tick waits until the next one; this keeps each step simple.
      else if (!state.components.path[id]) dispatch(state, content, id);
    }
  },
  isIdle(state, carrier) {
    return haulsOf(state)[carrier] === undefined;
  },
};
