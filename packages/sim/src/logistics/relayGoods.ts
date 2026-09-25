// Flag relay: which goods enter the network, where each is bound, and what they reserve.
import type { ResourceId } from '@candlemarch/content';
import { entityDoor, tileIndex } from '../grid';
import type { EntityId } from '../state';
import { amountOnStockpile } from '../stockpiles';
import { distancesTo, stockpileFlags } from './flagNetwork';
import type { Destination, FlagRelayState, Good, RelayTick } from './relayState';
import { canServe, type Demand, listDemands, listSupplies } from './supplyDemand';

/**
 * Flags where goods for or from `entity` are handed over: a building's or site's door if it's a
 * Flag, or the placed Flags serving a stockpile.
 */
export function handoverFlags(tick: RelayTick, entity: EntityId): number[] {
  const { state, content, relay, net } = tick;
  if (state.components.stockpile[entity]) return stockpileFlags(state, relay, entity);
  const door = entityDoor(state, content, entity);
  if (!door) return [];
  const i = tileIndex(state.map, door.x, door.y);
  return net.flags.has(i) ? [i] : [];
}

/** Whether a good can still be delivered where it's bound: the target wants goods at that Flag. */
function destinationValid(tick: RelayTick, to: Destination): boolean {
  const { site, stockpile } = tick.state.components;
  if (!site[to.entity] && !stockpile[to.entity]) return false;
  return handoverFlags(tick, to.entity).includes(to.flag);
}

/** Whether `good` is delivered at Flag `flag`: it's bound there, and still wanted there. */
export function deliveredAt(tick: RelayTick, good: Good, flag: number): boolean {
  return good.to?.flag === flag && destinationValid(tick, good.to);
}

/** Whether Flag `flag` has room for another good. */
export function flagHasRoom(tick: RelayTick, flag: number): boolean {
  return (tick.relay.waiting[flag]?.length ?? 0) < tick.content.logistics.flagCapacity;
}

/** Adds a good to the end of a Flag's queue. Doesn't check room. */
export function putOnFlag(relay: FlagRelayState, flag: number, good: Good): void {
  const waiting = relay.waiting[flag];
  if (waiting) waiting.push(good);
  else relay.waiting[flag] = [good];
}

/** Every good in the network: waiting on Flags, then in carriers' hands (or assigned to them). */
function allGoods(relay: FlagRelayState): Good[] {
  const goods: Good[] = [];
  for (const waiting of Object.values(relay.waiting)) goods.push(...waiting);
  for (const carrier of Object.values(relay.carriers)) if (carrier.good) goods.push(carrier.good);
  return goods;
}

/** Goods of `resource` bound for `target`. */
function incoming(relay: FlagRelayState, target: EntityId, resource: ResourceId): number {
  return allGoods(relay).filter((g) => g.to?.entity === target && g.resource === resource).length;
}

/** Goods of `resource` still lying on stockpile `pile` but already bound somewhere. */
function reservedOn(relay: FlagRelayState, pile: EntityId, resource: ResourceId): number {
  return allGoods(relay).filter((g) => g.onStockpile === pile && g.resource === resource).length;
}

/**
 * Checks the goods waiting on Flags. Goods on a tile that's no longer a Flag are lost. Goods
 * whose destination is gone, or can no longer be reached, lose it; if they still lie on a
 * stockpile, they simply stay there.
 */
export function checkWaitingGoods(tick: RelayTick): void {
  const { state, relay, net } = tick;
  for (const key of Object.keys(relay.waiting)) {
    const flag = Number(key);
    const waiting = relay.waiting[flag] ?? [];
    if (!net.flags.has(flag)) {
      delete relay.waiting[flag];
      continue;
    }
    const kept: Good[] = [];
    for (const good of waiting) {
      const reachable =
        good.to !== null &&
        destinationValid(tick, good.to) &&
        distancesTo(net, good.to.flag).has(flag);
      if (!reachable) good.to = null;
      const pile = good.onStockpile;
      if (pile !== undefined && (!good.to || !state.components.stockpile[pile])) continue;
      kept.push(good);
    }
    if (kept.length > 0) relay.waiting[flag] = kept;
    else delete relay.waiting[flag];
  }
}

/** Somewhere a good for a demand can come from. */
interface Source {
  /** Flag the good starts from. */
  flag: number;
  /** Puts one unit on its way to `to`. */
  send: (to: Destination) => void;
}

/**
 * Where goods for `demand` could come from right now: goods waiting on a Flag without a
 * destination first (Flags in ID order), then building buffers and stockpiles in `listSupplies`
 * order, each at every handover Flag with room. A stockpile never supplies another stockpile.
 */
function sources(tick: RelayTick, demand: Demand): Source[] {
  const { state, content, relay } = tick;
  const { resource } = demand;
  const result: Source[] = [];

  const waitingFlags = Object.keys(relay.waiting)
    .map(Number)
    .sort((a, b) => a - b);
  for (const flag of waitingFlags) {
    const good = relay.waiting[flag]?.find((g) => g.to === null && g.resource === resource);
    if (good) result.push({ flag, send: (to) => (good.to = to) });
  }

  for (const supply of listSupplies(state, content)) {
    if (!canServe(supply, demand)) continue;
    const building = state.components.building[supply.source];
    const pile = state.components.stockpile[supply.source];
    for (const flag of handoverFlags(tick, supply.source)) {
      if (!flagHasRoom(tick, flag)) continue;
      // Amounts are read live: `listSupplies` came before this tick's earlier sends.
      if (building && (building.stock[resource] ?? 0) > 0) {
        result.push({
          flag,
          send: (to) => {
            building.stock[resource] = (building.stock[resource] ?? 0) - 1;
            putOnFlag(relay, flag, { resource, to });
          },
        });
      } else if (
        pile &&
        amountOnStockpile(pile, resource) > reservedOn(relay, supply.source, resource)
      ) {
        result.push({
          flag,
          send: (to) => putOnFlag(relay, flag, { resource, to, onStockpile: supply.source }),
        });
      }
    }
  }
  return result;
}

/**
 * Binds goods to demands, one unit at a time: each demand (sites oldest first, then stockpiles)
 * takes goods from the source nearest along the road until its need is covered or nothing
 * connected is left. Ties go to the lower source Flag ID, then the lower destination Flag ID,
 * then the earlier source.
 */
export function dispatchGoods(tick: RelayTick): void {
  const { state, content, relay, net } = tick;
  for (const demand of listDemands(state, content)) {
    const targets = handoverFlags(tick, demand.target).sort((a, b) => a - b);
    let need = demand.amount - incoming(relay, demand.target, demand.resource);
    while (need > 0) {
      let best: { source: Source; to: number; distance: number } | null = null;
      for (const source of sources(tick, demand)) {
        for (const to of targets) {
          const distance = distancesTo(net, to).get(source.flag);
          if (distance === undefined) continue;
          const better =
            !best ||
            distance < best.distance ||
            (distance === best.distance && source.flag < best.source.flag) ||
            (distance === best.distance && source.flag === best.source.flag && to < best.to);
          if (better) best = { source, to, distance };
        }
      }
      if (!best) break;
      best.source.send({ entity: demand.target, flag: best.to });
      need -= 1;
    }
  }
}
