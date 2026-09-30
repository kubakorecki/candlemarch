// Workplace yards: the tile of a Workplace beside its door where its output buffer piles up
// (`BuildingDef.outputBuffer`). A yard holds `logistics.yardCapacity` units in total, all the
// building's outputs together; a catch, basket or batch goes in only if it fits whole.
import type { Content, ResourceAmount, ResourceId } from '@candlemarch/content';
import type { EntityId, GameState } from './state';

/** Units in building `id`'s yard, all its outputs together; 0 without a yard. */
export function yardAmount(state: GameState, content: Content, id: EntityId): number {
  const b = state.components.building[id];
  const resources = b ? (content.buildings[b.type].outputBuffer?.resources ?? []) : [];
  let total = 0;
  for (const r of resources) total += b?.stock[r] ?? 0;
  return total;
}

/** Units building `id`'s yard still has room for, whatever they are; 0 without a yard. */
export function yardRoom(state: GameState, content: Content, id: EntityId): number {
  const b = state.components.building[id];
  if (!b || !content.buildings[b.type].outputBuffer) return 0;
  return Math.max(0, content.logistics.yardCapacity - yardAmount(state, content, id));
}

/** Units of `resource` building `id` has room for in its yard; 0 if it doesn't make `resource`. */
export function outputRoom(
  state: GameState,
  content: Content,
  id: EntityId,
  resource: ResourceId,
): number {
  const b = state.components.building[id];
  const makes = b && content.buildings[b.type].outputBuffer?.resources.includes(resource);
  return makes ? yardRoom(state, content, id) : 0;
}

/** Whether all of `goods` fit in building `id`'s yard together, each a resource it makes. */
export function fitsInYard(
  state: GameState,
  content: Content,
  id: EntityId,
  goods: readonly ResourceAmount[],
): boolean {
  const b = state.components.building[id];
  const makes = b ? (content.buildings[b.type].outputBuffer?.resources ?? []) : [];
  if (!goods.every((g) => makes.includes(g.resource))) return false;
  const total = goods.reduce((sum, g) => sum + g.amount, 0);
  return total <= yardRoom(state, content, id);
}
