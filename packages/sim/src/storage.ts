// Storage (spec, Logistics: "Where goods are kept"): the goods a building keeps inside it, not
// drawn on the ground and listed in its panel. A Granary's Food and the trade post's goods for sale
// are Storage; a Workplace's yard is not Storage.
import type { Content, ResourceAmount, ResourceId } from '@candlemarch/content';
import { foodIds } from './granary';
import type { EntityId, GameState } from './state';

/** What a building keeps in its Storage: each good it holds, all of them together, and the room. */
export interface Storage {
  /** A line per good it holds (none it has 0 of), in content order. */
  goods: ResourceAmount[];
  amount: number;
  capacity: number;
}

/**
 * Building `id`'s Storage, or null for a building that keeps none (or one that's gone): a
 * Granary's Food against its `foodCapacity`, the trade post's goods for sale against its
 * `tradePost.capacity`.
 */
export function storageOf(state: GameState, content: Content, id: EntityId): Storage | null {
  const b = state.components.building[id];
  const def = b && content.buildings[b.type];
  const capacity = def?.foodCapacity ?? def?.tradePost?.capacity;
  if (!b || !def || capacity === undefined) return null;
  const kept = def.tradePost ? (Object.keys(content.resources) as ResourceId[]) : foodIds(content);
  const goods: ResourceAmount[] = [];
  let amount = 0;
  for (const resource of kept) {
    const held = b.stock[resource] ?? 0;
    if (held <= 0) continue;
    goods.push({ resource, amount: held });
    amount += held;
  }
  return { goods, amount, capacity };
}
