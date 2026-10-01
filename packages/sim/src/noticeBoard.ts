// The notice board (spec, Trades and masters): one a village, unlocked at Hamlet, where Charters
// and Delivery orders are posted. Charters come with ticket 11, Delivery orders with ticket 26;
// until then nothing is posted.
import type { BuildingId, Content } from '@candlemarch/content';
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
  /** Every condition holds, so it can be accepted. */
  canAccept: boolean;
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
export function postings(_state: GameState, _content: Content): Posting[] {
  return [];
}
