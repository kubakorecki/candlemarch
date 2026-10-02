// Charters (`charters.ts`): at each Dawn the Charters whose time is up are withdrawn, then, while
// a notice board stands, the board is filled up to `charters.max` (PRNG).
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import { postCharters, withdrawCharters } from '../charters';
import { noticeBoardOf } from '../noticeBoard';
import type { GameState } from '../state';

export function chartersSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  withdrawCharters(state, content);
  if (noticeBoardOf(state, content) !== null) postCharters(state, content);
}
