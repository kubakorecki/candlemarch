// The hero: one per game, not a villager, walks only where the player orders it.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';
import { rerouteTo } from './systems/movement';

/** An order for the hero, given by right-clicking. */
export type HeroOrder = { order: 'move'; x: number; y: number };

/** The hero's entity ID, or null if this game has none. */
export function heroOf(state: GameState): EntityId | null {
  return idsOf(state.components.hero)[0] ?? null;
}

/**
 * Gives the hero a new order, replacing the current one. A move walks to the tile by the quickest
 * route (roads included). An order the hero can't carry out, such as a tile it can't reach, is
 * ignored and the current order stands.
 */
export function orderHero(state: GameState, content: Content, order: HeroOrder): void {
  const id = heroOf(state);
  if (id === null) return;
  switch (order.order) {
    case 'move': {
      rerouteTo(state, content, id, [{ x: order.x, y: order.y }]);
      return;
    }
  }
}
