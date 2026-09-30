// Growth: at each Dawn, everything growing (Saplings) moves on a drawing stage, or grows into what
// it becomes (a tree) once its time is up.
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import { idsOf } from '../entities';
import { grow, isGrowing } from '../forest';
import type { GameState } from '../state';

export function growthSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  for (const id of idsOf(state.components.mapObject)) {
    if (isGrowing(state, content, id)) grow(state, content, id);
  }
}
