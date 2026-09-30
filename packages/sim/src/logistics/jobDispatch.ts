// Job dispatch: a dispatcher hands each idle carrier one haul (pick up at A, drop at B).
// Chosen over flag relay in docs/adr/0001-logistics-model.md.
import type { Content, ResourceId } from '@candlemarch/content';
import { isNight } from '../calendar';
import { takeFromCache } from '../dens';
import { idsOf } from '../entities';
import { foodIds, isGranary } from '../granary';
import { entityDoor, stockpileTileIndices, tileAt, tileIndex } from '../grid';
import { groundworkDropTiles } from '../groundwork';
import { lightDef } from '../lights';
import { tileDistance } from '../pathfinding';
import type { EntityId, GameState, Store, Tile } from '../state';
import { addToTile, amountOnTile, roomOnTile, takeFromTile } from '../stockpiles';
import { isAt, stopAtNextTile, villagerTile, walkCosts, walkTo } from '../systems/movement';
import { isAtWork } from '../villagers';
import { isHouse } from '../warmth';
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
  /** Building, stockpile or cache to pick up from. */
  from: EntityId;
  /** Construction site, workshop, Granary or stockpile to deliver to. */
  to: EntityId;
  /** Stockpile or cache tile (map tile index) to pick up from. Absent when `from` is a building. */
  fromTile?: number;
  /**
   * Tile (map tile index) to deliver on: a stockpile tile, or where a groundwork site is supplied
   * from (`groundworkDropTiles`). Absent when goods go in at `to`'s door.
   */
  toTile?: number;
  /** `pickup`: walking to `from`. `dropoff`: carrying to `to`. `return`: carrying back to `from` because `to` is gone. */
  phase: 'pickup' | 'dropoff' | 'return';
}

export interface LogisticsState {
  /** Current haul per carrier, keyed by the carrier's entity ID. */
  hauls: Store<Haul>;
  /**
   * What the last Haul to a stockpile moved. Stockpile demand starts with the resource after it,
   * so a steady supply of one good never starves another. Absent until the first such Haul.
   */
  lastToStockpile?: ResourceId;
}

function carrierIds(state: GameState): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.job === 'carrier');
}

/** Units of `resource` at `source` already promised to hauls that haven't picked up yet. */
export function reserved(hauls: Store<Haul>, source: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.from === source && haul.resource === resource && haul.phase === 'pickup') {
      total += haul.amount;
    }
  }
  return total;
}

/** Units of `resource` carriers are bringing to `target`. */
export function haulsIncoming(hauls: Store<Haul>, target: EntityId, resource: ResourceId): number {
  let total = 0;
  for (const haul of Object.values(hauls)) {
    if (haul.to === target && haul.resource === resource && haul.phase !== 'return')
      total += haul.amount;
  }
  return total;
}

/**
 * Units of `resource` on their way to `target`: carriers' hauls, plus what the hero promised a
 * site or workshop from the moment it was ordered to deliver there. For a Granary, whose room
 * every Food shares, hauls of any Food count.
 */
function incoming(
  state: GameState,
  content: Content,
  target: EntityId,
  resource: ResourceId,
): number {
  if (isGranary(state, content, target)) {
    return foodIds(content).reduce(
      (sum, food) => sum + haulsIncoming(state.logistics.hauls, target, food),
      0,
    );
  }
  let total = haulsIncoming(state.logistics.hauls, target, resource);
  if (state.components.stockpile[target]) return total;
  for (const hero of Object.values(state.components.hero)) {
    const order = hero.order;
    if (order?.kind === 'deliver' && order.target === target && order.resource === resource) {
      total += order.amount;
    }
  }
  return total;
}

/** Units on stockpile tile `index` promised to hauls that haven't picked up yet. */
export function reservedOnTile(hauls: Store<Haul>, index: number): number {
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
export function freeRoomOnTile(
  state: GameState,
  content: Content,
  pile: EntityId,
  index: number,
  resource: ResourceId,
): number {
  const stockpile = state.components.stockpile[pile];
  if (!stockpile) return 0;
  let room = roomOnTile(stockpile, index, resource, content.logistics.stockpileTileCapacity);
  for (const haul of Object.values(state.logistics.hauls)) {
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
export function nearestTile(
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
  /** The tile is a stockpile or cache tile, not a door. */
  onStockpile: boolean;
  available: number;
}

/**
 * Where to pick up from `supply`: the building's door, the cache's tile, or the stockpile tile
 * nearest to tile `near` holding unreserved goods. Null if nothing is free to take.
 */
function pickupFor(
  state: GameState,
  content: Content,
  supply: Supply,
  near: number,
): Pickup | null {
  const { hauls } = state.logistics;
  const { map } = state;
  if (supply.kind === 'building') {
    const door = entityDoor(state, content, supply.source);
    const available = supply.amount - reserved(hauls, supply.source, supply.resource);
    if (!door || available <= 0) return null;
    return { tile: tileIndex(map, door.x, door.y), onStockpile: false, available };
  }
  if (supply.kind === 'cache') {
    const at = state.components.tile[supply.source];
    const available = supply.amount - reserved(hauls, supply.source, supply.resource);
    if (!at || available <= 0) return null;
    // Picked up on its tile, like a stockpile tile.
    return { tile: tileIndex(map, at.x, at.y), onStockpile: true, available };
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
  /** The tile is kept in `Haul.toTile`: a stockpile tile or beside a groundwork site, not a door. */
  onTile: boolean;
  room: number;
}

/**
 * Where to drop goods for `demand`: the site's or workshop's door, the tile a groundwork site is
 * supplied from that's quickest to walk to from tile `near`, or the stockpile tile nearest to
 * `near` with room. Null if there's nowhere to put them.
 */
function dropoffFor(
  state: GameState,
  content: Content,
  demand: Demand,
  near: number,
): Dropoff | null {
  const { map } = state;
  const groundwork = groundworkDropTiles(state, content, demand.target);
  if (groundwork.length > 0) {
    const costs = walkCosts(state, content, near);
    const tiles = groundwork.map((t) => tileIndex(map, t.x, t.y));
    // The quickest, ties to the first in `groundworkDropTiles`' order.
    const best = tiles.reduce((a, b) => (costs.costTo(b) < costs.costTo(a) ? b : a));
    return { tile: best, onTile: true, room: demand.amount };
  }
  if (demand.kind !== 'stockpile') {
    const door = entityDoor(state, content, demand.target);
    if (!door) return null;
    return { tile: tileIndex(map, door.x, door.y), onTile: false, room: demand.amount };
  }
  const tiles = stockpileTileIndices(state, demand.target);
  const found = nearestTile(map.width, tiles, near, (i) =>
    freeRoomOnTile(state, content, demand.target, i, demand.resource),
  );
  return found && { tile: found.tile, onTile: true, room: found.amount };
}

/** Tile a haul walks to at one end: its own tile if it has one (`fromTile`/`toTile`), else the door. */
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
  const { hauls } = state.logistics;
  const { building, site, stockpile, cache, villager, path } = state.components;
  const carrier = villager[id];
  if (!carrier) {
    delete hauls[id];
    return;
  }

  // The site was cancelled or the stockpile removed: abandon the pickup, or bring the goods back.
  if (!site[haul.to] && !building[haul.to] && !stockpile[haul.to] && haul.phase !== 'return') {
    stopAtNextTile(state, id);
    if (haul.phase === 'pickup') delete hauls[id];
    else haul.phase = 'return';
    return;
  }
  // The source is gone: there's nothing to pick up, and nowhere to return goods to.
  if (
    !building[haul.from] &&
    !stockpile[haul.from] &&
    !cache[haul.from] &&
    haul.phase !== 'dropoff'
  ) {
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
      const workshop = building[haul.to];
      const pile = stockpile[haul.to];
      if (carrier.carrying && target) {
        target.delivered[haul.resource] = (target.delivered[haul.resource] ?? 0) + haul.amount;
      } else if (
        carrier.carrying &&
        workshop &&
        (isGranary(state, content, haul.to) ||
          isHouse(state, content, haul.to) ||
          lightDef(state, content, haul.to))
      ) {
        workshop.stock[haul.resource] = (workshop.stock[haul.resource] ?? 0) + haul.amount;
      } else if (carrier.carrying && workshop) {
        workshop.input[haul.resource] = (workshop.input[haul.resource] ?? 0) + haul.amount;
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
      returnGoods(state, id, haul);
      return;
    }
  }
}

/**
 * Ends carrier `id`'s haul: goods in hand go back to where they were picked up, and the carrier
 * clears its hands and has no haul.
 * Returned goods go back even if that overfills: capacity limits new hauls, not returns.
 * A stockpile tile that holds another resource by now can't take them, and they're lost.
 */
function returnGoods(state: GameState, id: EntityId, haul: Haul): void {
  const carrier = state.components.villager[id];
  const source = state.components.building[haul.from];
  const pile = state.components.stockpile[haul.from];
  const stock = (source ?? state.components.cache[haul.from])?.stock;
  if (carrier?.carrying && stock) {
    stock[haul.resource] = (stock[haul.resource] ?? 0) + carrier.carrying.amount;
  } else if (carrier?.carrying && pile && haul.fromTile !== undefined) {
    addToTile(pile, haul.fromTile, carrier.carrying);
  }
  if (carrier) carrier.carrying = null;
  delete state.logistics.hauls[id];
}

/**
 * Drops carrier `id`'s haul on the spot, when it's given another Job: goods in hand go straight
 * back to where they were picked up. Stopping its walk is the caller's.
 */
export function abandonHaul(state: GameState, id: EntityId): void {
  const haul = state.logistics.hauls[id];
  if (haul) returnGoods(state, id, haul);
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
  if (state.components.cache[haul.from]) {
    return takeFromCache(state, haul.from, haul.resource, haul.amount);
  }
  const pile = state.components.stockpile[haul.from];
  if (!pile || haul.fromTile === undefined) return 0;
  return takeFromTile(pile, haul.fromTile, haul.resource, haul.amount);
}

/**
 * Gives an idle carrier the first unmet demand group (sites one by one, then workshop input
 * buffers one by one, then stockpiles by priority), served from the source quickest to walk to
 * with goods free to take. Among a group's demands the carrier takes the one quickest to walk to
 * from the pickup, roads included, so goods go to the nearest stockpile with room.
 */
function dispatch(state: GameState, content: Content, id: EntityId): void {
  const { hauls } = state.logistics;
  const { map } = state;
  const carrier = state.components.villager[id];
  const here = villagerTile(state, id);
  if (!carrier || !here) return;
  const capacity = content.jobs[carrier.job].carryCapacity;
  const hereIndex = tileIndex(map, here.x, here.y);
  const supplies = listSupplies(state, content);
  const fromHere = walkCosts(state, content, hereIndex);

  for (const group of demandGroups(state, listDemands(state, content))) {
    const open = group.flatMap((demand) => {
      const need = demand.amount - incoming(state, content, demand.target, demand.resource);
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
        const cost = fromHere.costTo(pickup.tile);
        return cost === Number.POSITIVE_INFINITY ? [] : [{ source: s.source, pickup, cost }];
      })
      .sort((a, b) => a.cost - b.cost || a.source - b.source);

    for (const { source, pickup } of sources) {
      const costs = walkCosts(state, content, pickup.tile);
      const dropoffs = open
        .flatMap(({ demand, need }) => {
          const dropoff = dropoffFor(state, content, demand, pickup.tile);
          if (!dropoff) return [];
          const cost = costs.costTo(dropoff.tile);
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
      if (dropoff.onTile) haul.toTile = dropoff.tile;
      hauls[id] = haul;
      if (demand.kind === 'stockpile') state.logistics.lastToStockpile = demand.resource;
      return;
    }
  }
}

/** Advances every carrier's haul by one tick, and hands idle carriers new ones. */
export function updateHauls(state: GameState, content: Content): void {
  const { hauls } = state.logistics;
  const { villager } = state.components;
  const night = isNight(state.tick, content);
  for (const id of carrierIds(state)) {
    const haul = hauls[id];
    if (haul) advanceHaul(state, content, id, haul);
    // A carrier freed this tick waits until the next one; this keeps each step simple. No new
    // Haul starts after Dusk.
    else {
      const v = villager[id];
      if (v && !state.components.path[id] && !night && isAtWork(v)) dispatch(state, content, id);
    }
  }
}

/** Whether the carrier has no haul right now, so a Workplace may draft it. */
export function isCarrierIdle(state: GameState, carrier: EntityId): boolean {
  return state.logistics.hauls[carrier] === undefined;
}
