// Hunting grounds: at each Dawn, Game comes back where it's due (`regrowGame`).
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import { idsOf } from '../entities';
import { regrowGame } from '../huntingGrounds';
import type { GameState } from '../state';

export function huntingGroundsSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  for (const id of idsOf(state.components.huntingGround)) {
    const ground = state.components.huntingGround[id];
    if (ground) regrowGame(state, content, ground);
  }
}
