// Delivery orders (spec, Trades and masters: Side quests in M5): one-off side quests on the notice
// board. One is up at a time (`state.noticeBoard.delivery`): a good the village can make, an
// amount, a deadline and a coin reward, drawn with the PRNG from `content.deliveries`. Once the
// player accepts it, the trade post wants the goods (a `delivery` demand, served before
// Granaries), and Carriers hand them over there as they arrive: they're gone, not kept for sale.
// Filled, its reward goes to the Treasury; at its deadline it fails, with nothing back. Either
// way the next is posted `gapDays` after (`systems/deliveries.ts`). No recurring orders.
import type { BuildingId, Content, CropId, ResourceId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { isKnownCrop } from './fields';
import { waitingForMaster } from './masters';
import type { PostingCondition } from './noticeBoard';
import { randomInt } from './rng';
import type { DeliveryOrder, EntityId, GameState } from './state';
import { tradePostOf } from './tradePost';
import { COIN } from './treasury';

/**
 * Whether the village can make `resource`: a building standing makes it (an output buffer holds
 * it) and isn't waiting for its Master; a Crop's good only once the Crop is known.
 */
export function canMake(state: GameState, content: Content, resource: ResourceId): boolean {
  const crop = (Object.keys(content.crops) as CropId[]).find(
    (c) => content.crops[c].resource === resource,
  );
  if (crop !== undefined && !isKnownCrop(state, content, crop)) return false;
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    if (!b || !content.buildings[b.type].outputBuffer?.resources.includes(resource)) continue;
    if (!waitingForMaster(state, content, id)) return true;
  }
  return false;
}

/** Building types that are a trade post: where Delivery orders are brought. */
function tradePostTypes(content: Content): BuildingId[] {
  return (Object.keys(content.buildings) as BuildingId[]).filter(
    (b) => content.buildings[b].tradePost !== undefined,
  );
}

/** What a Delivery order needs before it can be accepted: a trade post standing. */
export function deliveryConditions(state: GameState, content: Content): PostingCondition[] {
  const met = tradePostOf(state, content) !== null;
  return [{ kind: 'building', anyOf: tradePostTypes(content), met }];
}

/** Posts a Delivery order drawn with the PRNG among those of goods the village can make, if any. */
export function postDelivery(state: GameState, content: Content): void {
  const offered = content.deliveries.orders.filter((o) => canMake(state, content, o.resource));
  if (offered.length === 0) return;
  const def = offered[randomInt(state, offered.length)];
  if (!def) return;
  const board = state.noticeBoard;
  board.delivery = {
    id: board.nextPostingId,
    resource: def.resource,
    amount: def.amount,
    delivered: 0,
    reward: def.reward,
    endsAt: state.tick + def.days * content.calendar.dayTicks,
    accepted: false,
  };
  board.nextPostingId += 1;
}

/** Takes the Delivery order down, filled or failed; the next comes `gapDays` from today. */
export function closeDelivery(state: GameState, content: Content): void {
  const today = calendarAt(state.tick, content).day;
  state.noticeBoard.delivery = null;
  state.noticeBoard.nextDeliveryDay = today + content.deliveries.gapDays;
}

/** Accepts Delivery order `id` if it's up, not accepted yet, and every condition holds. */
export function acceptDelivery(state: GameState, content: Content, id: number): void {
  const order = state.noticeBoard.delivery;
  if (!order || order.id !== id || order.accepted) return;
  if (!deliveryConditions(state, content).every((c) => c.met)) return;
  order.accepted = true;
}

/** The accepted Delivery order still wanting `resource`, or null. */
function wanting(state: GameState, resource: ResourceId): DeliveryOrder | null {
  const order = state.noticeBoard.delivery;
  return order?.accepted && order.resource === resource ? order : null;
}

/** Units of `resource` the accepted Delivery order still lacks (0 without one asking for it). */
export function deliveryWants(state: GameState, resource: ResourceId): number {
  const order = wanting(state, resource);
  return order ? order.amount - order.delivered : 0;
}

/**
 * Goods a Carrier brings into trade post `post`: the accepted Delivery order takes what it lacks
 * (paying its reward once filled), the rest is for sale if the good has a sell rule, else waits
 * in the post's `stock` for Carriers to take back (goods for an order filled or failed on the way).
 */
export function receiveAtTradePost(
  state: GameState,
  content: Content,
  post: EntityId,
  resource: ResourceId,
  amount: number,
): void {
  const b = state.components.building[post];
  if (!b) return;
  const order = wanting(state, resource);
  const taken = order ? Math.min(amount, order.amount - order.delivered) : 0;
  if (order && taken > 0) {
    order.delivered += taken;
    if (order.delivered >= order.amount) {
      state.treasury += order.reward * COIN;
      closeDelivery(state, content);
    }
  }
  const rest = amount - taken;
  if (rest <= 0) return;
  const into = state.tradePost.keep[resource] !== undefined ? b.input : b.stock;
  into[resource] = (into[resource] ?? 0) + rest;
}
