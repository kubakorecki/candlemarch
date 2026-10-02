// Delivery orders (`deliveries.ts`): at each Dawn the order up fails once its deadline has come,
// and with none up, a notice board standing and the gap since the last one over, the next is
// posted (PRNG).
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { closeDelivery, postDelivery } from '../deliveries';
import { noticeBoardOf } from '../noticeBoard';
import type { GameState } from '../state';

export function deliveriesSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  const board = state.noticeBoard;
  if (board.delivery && state.tick >= board.delivery.endsAt) closeDelivery(state, content);
  if (board.delivery !== null || noticeBoardOf(state, content) === null) return;
  if (calendarAt(state.tick, content).day < board.nextDeliveryDay) return;
  postDelivery(state, content);
}
