// Flag relay: Segments and the carriers working them.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import { stockpileTileIndices, tileAt, tileIndex } from '../grid';
import { tileDistance } from '../pathfinding';
import type { EntityId, GameState } from '../state';
import { addToTile, amountOnTile, roomOnTile, takeFromTile } from '../stockpiles';
import { stopAtNextTile, villagerTile, walkAlong, walkTo } from '../systems/movement';
import { nextHop } from './flagNetwork';
import { deliveredAt, flagHasRoom, putOnFlag } from './relayGoods';
import type { FlagRelayState, Good, RelayCarrier, RelayTick, Segment } from './relayState';

/** IDs of Segments without a carrier, oldest first. */
export function unstaffedSegmentIds(relay: FlagRelayState): number[] {
  const staffed = new Set(Object.values(relay.carriers).map((c) => c.segment));
  return idsOf(relay.segments).filter((id) => !staffed.has(id));
}

function segmentKey(segment: Segment): string {
  return segment.tiles.join(',');
}

/** Takes a carrier off its Segment, empty-handed. */
function release(state: GameState, relay: FlagRelayState, id: EntityId): void {
  stopAtNextTile(state, id);
  const villager = state.components.villager[id];
  if (villager) villager.carrying = null;
  delete relay.carriers[id];
}

/** Whether a Segment's Flags and road tiles are all still there, though it may no longer be one. */
function intact(state: GameState, flags: Set<number>, segment: Segment): boolean {
  const { roads } = state.map;
  return (
    segment.ends.every((f) => flags.has(f)) && segment.tiles.every((t) => roads[t] !== undefined)
  );
}

/**
 * Brings the stored Segments in line with the road network. A Segment whose road changed in any
 * way is removed and its carrier released; new ones get the next IDs, in the order given.
 * If its Flag or path was removed, the goods in its carrier's hands are lost. If it only changed
 * because the road around it did (a Flag or door added in it, a road joined to it), the carrier
 * puts its load on the Flag it was heading to, even past capacity.
 */
export function reconcileSegments(
  state: GameState,
  relay: FlagRelayState,
  flags: Set<number>,
  derived: readonly Segment[],
): void {
  const current = new Set(derived.map(segmentKey));
  for (const id of idsOf(relay.carriers)) {
    const carrier = relay.carriers[id] as RelayCarrier;
    const segment = relay.segments[carrier.segment];
    const isCarrier = state.components.villager[id]?.job === 'carrier';
    if (segment && current.has(segmentKey(segment)) && isCarrier) continue;
    const good = carrier.good;
    if (segment && good && good.onStockpile === undefined && intact(state, flags, segment)) {
      putOnFlag(relay, carrier.task.flag, good);
    }
    release(state, relay, id);
  }
  const kept = new Set<string>();
  for (const id of idsOf(relay.segments)) {
    const key = segmentKey(relay.segments[id] as Segment);
    if (current.has(key)) kept.add(key);
    else delete relay.segments[id];
  }
  for (const segment of derived) {
    if (kept.has(segmentKey(segment))) continue;
    relay.segments[relay.nextSegmentId] = segment;
    relay.nextSegmentId += 1;
  }
}

/**
 * Gives each unstaffed Segment, oldest first, the lowest-ID idle carrier that can reach it. The
 * carrier walks to the nearer end (ties to the lower Flag ID) and waits there.
 */
export function staffSegments(state: GameState, content: Content, relay: FlagRelayState): void {
  const { map } = state;
  const { villager } = state.components;
  for (const id of unstaffedSegmentIds(relay)) {
    const [a, b] = (relay.segments[id] as Segment).ends;
    for (const carrier of idsOf(villager)) {
      const here = villagerTile(state, carrier);
      if (villager[carrier]?.job !== 'carrier' || relay.carriers[carrier] || !here) continue;
      const from = tileIndex(map, here.x, here.y);
      const flag = tileDistance(map.width, from, b) < tileDistance(map.width, from, a) ? b : a;
      if (!walkTo(state, content, carrier, [tileAt(map, flag)])) continue;
      relay.carriers[carrier] = { segment: id, task: { kind: 'toFlag', flag }, good: null };
      break;
    }
  }
}

/** The Segment's end that isn't `flag`. */
function otherEnd(segment: Segment, flag: number): number {
  return segment.ends[0] === flag ? segment.ends[1] : segment.ends[0];
}

/** Walks along the Segment from the end `from` to its other end. */
function walkSegment(state: GameState, id: EntityId, segment: Segment, from: number): void {
  const tiles = segment.ends[0] === from ? segment.tiles : [...segment.tiles].reverse();
  walkAlong(state, id, tiles.slice(1));
}

/** Gives the carrier a good to hold, or empties its hands. */
function hold(tick: RelayTick, id: EntityId, carrier: RelayCarrier, good: Good | null): void {
  carrier.good = good;
  const villager = tick.state.components.villager[id];
  if (villager) villager.carrying = good ? { resource: good.resource, amount: 1 } : null;
}

/**
 * The stockpile tile nearest to Flag `flag` with `amountAt` above 0, ties to the lowest tile
 * index; or null.
 */
function nearestPileTile(
  tick: RelayTick,
  pile: EntityId,
  flag: number,
  amountAt: (tile: number) => number,
): number | null {
  let best: { tile: number; distance: number } | null = null;
  for (const tile of stockpileTileIndices(tick.state, pile)) {
    if (amountAt(tile) <= 0) continue;
    const distance = tileDistance(tick.state.map.width, flag, tile);
    if (!best || distance < best.distance) best = { tile, distance };
  }
  return best?.tile ?? null;
}

/** Other carriers walking to stockpile tile `tile` to do `kind`, with the goods they're after. */
function headingTo(tick: RelayTick, self: EntityId, kind: 'load' | 'unload', tile: number): Good[] {
  const goods: Good[] = [];
  for (const id of idsOf(tick.relay.carriers)) {
    const c = tick.relay.carriers[id] as RelayCarrier;
    if (id !== self && c.task.kind === kind && c.task.tile === tile && c.good) goods.push(c.good);
  }
  return goods;
}

/**
 * Hands over a good at its destination Flag: straight into a site, or onto the stockpile tile
 * nearest the Flag with room left once other carriers heading there unload (ties to the lowest
 * tile index). With no room anywhere, the good is lost.
 */
function deliver(
  tick: RelayTick,
  id: EntityId,
  carrier: RelayCarrier,
  flag: number,
  good: Good,
): void {
  const { state, content } = tick;
  const target = good.to?.entity ?? -1;
  const site = state.components.site[target];
  if (site) {
    site.delivered[good.resource] = (site.delivered[good.resource] ?? 0) + 1;
    hold(tick, id, carrier, null);
    carrier.task = { kind: 'idle', flag };
    return;
  }
  const pile = state.components.stockpile[target];
  const capacity = content.logistics.stockpileTileCapacity;
  const tile = pile
    ? nearestPileTile(tick, target, flag, (t) => {
        const others = headingTo(tick, id, 'unload', t);
        if (others.some((g) => g.resource !== good.resource)) return 0;
        return roomOnTile(pile, t, good.resource, capacity) - others.length;
      })
    : null;
  if (tile === null || !walkTo(state, content, id, [tileAt(state.map, tile)])) {
    hold(tick, id, carrier, null);
    carrier.task = { kind: 'idle', flag };
    return;
  }
  carrier.task = { kind: 'unload', flag, tile };
}

/**
 * Sends a good in hand on from Flag `flag`: delivers it if this is its destination, otherwise
 * carries it along the Segment.
 */
function sendOn(
  tick: RelayTick,
  id: EntityId,
  carrier: RelayCarrier,
  segment: Segment,
  flag: number,
): void {
  const good = carrier.good;
  if (!good) return;
  if (deliveredAt(tick, good, flag)) {
    deliver(tick, id, carrier, flag, good);
    return;
  }
  walkSegment(tick.state, id, segment, flag);
  carrier.task = { kind: 'carry', flag: otherEnd(segment, flag) };
}

/**
 * A carrier waiting at Flag `flag` looks for work: the oldest good there that is delivered here
 * or whose next hop is the other end. Failing that, if a good at the other end is to be delivered
 * there or to come this way, it walks over.
 */
function findWork(
  tick: RelayTick,
  id: EntityId,
  carrier: RelayCarrier,
  segment: Segment,
  flag: number,
) {
  const { state, relay, net } = tick;
  const other = otherEnd(segment, flag);
  const waiting = relay.waiting[flag] ?? [];
  const index = waiting.findIndex(
    (g) => g.to !== null && (g.to.flag === flag || nextHop(net, flag, g.to.flag) === other),
  );
  const good = waiting[index];
  if (good) {
    waiting.splice(index, 1);
    if (waiting.length === 0) delete relay.waiting[flag];
    if (good.onStockpile === undefined) {
      hold(tick, id, carrier, good);
      sendOn(tick, id, carrier, segment, flag);
      return;
    }
    // Still on the stockpile: load it from the nearest tile holding enough not already claimed.
    const pileId = good.onStockpile;
    const pile = state.components.stockpile[pileId];
    const tile = pile
      ? nearestPileTile(tick, pileId, flag, (t) => {
          const claimed = headingTo(tick, id, 'load', t).filter(
            (g) => g.resource === good.resource,
          );
          return amountOnTile(pile, t, good.resource) - claimed.length;
        })
      : null;
    // Nothing to load there after all, or no way there: the good stays on the stockpile, unbound.
    if (tile === null || !walkTo(state, tick.content, id, [tileAt(state.map, tile)])) return;
    carrier.good = good;
    carrier.task = { kind: 'load', flag, tile };
    return;
  }
  const workThere = (relay.waiting[other] ?? []).some(
    (g) => g.to !== null && (g.to.flag === other || nextHop(net, other, g.to.flag) === flag),
  );
  if (workThere) {
    walkSegment(state, id, segment, flag);
    carrier.task = { kind: 'toFlag', flag: other };
  }
}

/** Advances one staffed carrier by a tick. */
function advance(tick: RelayTick, id: EntityId, carrier: RelayCarrier): void {
  const { state, content, relay } = tick;
  const segment = relay.segments[carrier.segment];
  if (!segment || state.components.path[id]) return; // gone, or still walking
  const task = carrier.task;
  switch (task.kind) {
    case 'toFlag': {
      carrier.task = { kind: 'idle', flag: task.flag };
      return;
    }
    case 'idle': {
      findWork(tick, id, carrier, segment, task.flag);
      return;
    }
    case 'load': {
      const good = carrier.good;
      const pile =
        good?.onStockpile === undefined ? undefined : state.components.stockpile[good.onStockpile];
      const taken = good && pile ? takeFromTile(pile, task.tile, good.resource, 1) : 0;
      walkTo(state, content, id, [tileAt(state.map, task.flag)]);
      if (good && taken > 0) {
        delete good.onStockpile;
        hold(tick, id, carrier, good);
        carrier.task = { kind: 'back', flag: task.flag };
      } else {
        hold(tick, id, carrier, null);
        carrier.task = { kind: 'toFlag', flag: task.flag };
      }
      return;
    }
    case 'back': {
      sendOn(tick, id, carrier, segment, task.flag);
      return;
    }
    case 'carry': {
      const good = carrier.good;
      if (!good) {
        carrier.task = { kind: 'idle', flag: task.flag };
        return;
      }
      if (deliveredAt(tick, good, task.flag)) {
        deliver(tick, id, carrier, task.flag, good);
        return;
      }
      if (!flagHasRoom(tick, task.flag)) {
        // The Flag is full: swap for a good going back along this Segment, or wait holding it.
        const back = otherEnd(segment, task.flag);
        const waiting = relay.waiting[task.flag] ?? [];
        const index = waiting.findIndex(
          (g) =>
            g.to !== null &&
            g.onStockpile === undefined &&
            nextHop(tick.net, task.flag, g.to.flag) === back,
        );
        const swapped = waiting[index];
        if (!swapped) return;
        waiting.splice(index, 1);
        waiting.push(good);
        hold(tick, id, carrier, swapped);
        sendOn(tick, id, carrier, segment, task.flag);
        return;
      }
      putOnFlag(relay, task.flag, good);
      hold(tick, id, carrier, null);
      carrier.task = { kind: 'idle', flag: task.flag };
      return;
    }
    case 'unload': {
      const good = carrier.good;
      const pile = good?.to ? state.components.stockpile[good.to.entity] : undefined;
      // If the stockpile is gone, or the tile holds another resource by now, the good is lost.
      if (good && pile) addToTile(pile, task.tile, { resource: good.resource, amount: 1 });
      hold(tick, id, carrier, null);
      walkTo(state, content, id, [tileAt(state.map, task.flag)]);
      carrier.task = { kind: 'toFlag', flag: task.flag };
      return;
    }
  }
}

/** Advances every staffed carrier, in ID order. */
export function advanceCarriers(tick: RelayTick): void {
  const { carriers } = tick.relay;
  for (const id of idsOf(carriers)) {
    const carrier = carriers[id];
    if (carrier) advance(tick, id, carrier);
  }
}
