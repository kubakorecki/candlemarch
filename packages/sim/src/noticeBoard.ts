// The notice board (spec, Trades and masters): one a village, unlocked at Hamlet, where Charters
// and Delivery orders are posted (`state.noticeBoard`). Delivery orders are in `deliveries.ts`;
// Charters in `charters.ts`. The player accepts a posting with the `acceptPosting` command.
import type { BuildingId, Content, ResourceId, TradeId } from '@candlemarch/content';
import { acceptCharter, charterFee, charterStatus } from './charters';
import { acceptDelivery, deliveryConditions } from './deliveries';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';

/**
 * One condition of a posting, and whether it holds now: a free place in a House for whoever comes
 * (`housePlace`), or a building of one of `anyOf` standing (`building`). The tickets that post
 * things add the kinds they need.
 */
export type PostingCondition = { met: boolean } & (
  | { kind: 'housePlace' }
  | { kind: 'building'; anyOf: BuildingId[] }
);

/** Something posted on the notice board: a Charter or a Delivery order. */
export interface Posting {
  id: number;
  kind: 'charter' | 'delivery';
  conditions: PostingCondition[];
  /** Coin: what a Charter's fee costs, or what a Delivery order pays. */
  coin: number;
  /** The tick it comes down: a Charter is withdrawn, a Delivery order falls due. */
  endsAt: number;
  /** Not accepted yet, every condition holds and a Charter's fee is covered: it can be accepted. */
  canAccept: boolean;
  /** A Charter whose fee is more than the Treasury holds; false for a Delivery order. */
  coinShort: boolean;
  /** The player has accepted it. */
  accepted: boolean;
  /** What a Delivery order asks for and how much has been handed over; null for a Charter. */
  goods: { resource: ResourceId; amount: number; delivered: number } | null;
  /** A Charter's Master: their name and trade; null for a Delivery order. */
  master: { name: string; trade: TradeId } | null;
}

/** The finished notice board, or null while none stands. */
export function noticeBoardOf(state: GameState, content: Content): EntityId | null {
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    if (b && content.buildings[b.type].noticeBoard) return id;
  }
  return null;
}

/** What's posted on the notice board, oldest first. */
export function postings(state: GameState, content: Content): Posting[] {
  const posted: Posting[] = state.noticeBoard.charters.map((charter) => ({
    id: charter.id,
    kind: 'charter',
    ...charterStatus(state, content, charter),
    coin: charterFee(content, charter.trade),
    endsAt: charter.endsAt,
    accepted: false,
    goods: null,
    master: { name: charter.name, trade: charter.trade },
  }));
  const order = state.noticeBoard.delivery;
  if (order) {
    const conditions = deliveryConditions(state, content);
    posted.push({
      id: order.id,
      kind: 'delivery',
      conditions,
      coin: order.reward,
      endsAt: order.endsAt,
      canAccept: !order.accepted && conditions.every((c) => c.met),
      coinShort: false,
      accepted: order.accepted,
      goods: { resource: order.resource, amount: order.amount, delivered: order.delivered },
      master: null,
    });
  }
  return posted.sort((a, b) => a.id - b.id);
}

/** Accepts posting `id` (the `acceptPosting` command), if it can be accepted (`canAccept`). */
export function acceptPosting(state: GameState, content: Content, id: number): void {
  acceptDelivery(state, content, id);
  acceptCharter(state, content, id);
}
