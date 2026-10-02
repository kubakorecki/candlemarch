// Pure wording of what's posted on the notice board (the sim's `postings`) for its panel.
import { content } from '@candlemarch/content';
import type { Posting, PostingCondition } from '@candlemarch/sim';

/** One posting as its panel shows it. */
export interface PostingView {
  id: number;
  /** "Charter", "Delivery order". */
  title: string;
  /** Each condition worded, and whether it holds now. */
  conditions: { text: string; met: boolean }[];
  /** "Fee 300 coin", "Reward 200 coin". */
  coin: string;
  /** "Withdrawn in 6 days", "Due in 1 day". */
  ends: string;
  /** Every condition holds: the panel offers Accept. */
  canAccept: boolean;
  /** Accepted: the panel says so in place of Accept. */
  accepted: boolean;
  /** A Delivery order's goods: "Smoked fish 12 / 30 to the trade post"; null for a Charter. */
  goods: string | null;
}

/** A condition: "A free place in a House", "A mine or bog-iron digger". */
export function conditionText(condition: PostingCondition): string {
  if (condition.kind === 'housePlace') return 'A free place in a House';
  const names = condition.anyOf.map((b) => content.buildings[b].name.toLowerCase());
  return `A ${names.join(' or ')}`;
}

/** Posting `posting` worded for the panel at tick `tick`. */
export function postingView(posting: Posting, tick: number): PostingView {
  const days = Math.max(1, Math.ceil((posting.endsAt - tick) / content.calendar.dayTicks));
  const inDays = `in ${days} ${days === 1 ? 'day' : 'days'}`;
  const charter = posting.kind === 'charter';
  return {
    id: posting.id,
    title: charter ? 'Charter' : 'Delivery order',
    conditions: posting.conditions.map((c) => ({ text: conditionText(c), met: c.met })),
    coin: `${charter ? 'Fee' : 'Reward'} ${posting.coin} coin`,
    ends: charter ? `Withdrawn ${inDays}` : `Due ${inDays}`,
    canAccept: posting.canAccept,
    accepted: posting.accepted,
    goods:
      posting.goods &&
      `${content.resources[posting.goods.resource].name} ${posting.goods.delivered} / ${posting.goods.amount} to the trade post`,
  };
}
