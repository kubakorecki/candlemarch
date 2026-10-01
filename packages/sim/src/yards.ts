// Workplace yards: the tile of a Workplace beside its door where its output buffer piles up
// (`BuildingDef.outputBuffer`). A yard holds `logistics.yardCapacity` units in total, all the
// building's outputs together; a catch, basket or batch goes in only if it fits whole.
import type { Content, ResourceAmount, ResourceId } from '@candlemarch/content';
import { farmNoRoom } from './fields';
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

/**
 * What a gathering Workplace's yard has no room for, when that stops its worker: a hunter's
 * whole catch, a fisher's catch, everything a gatherer gathers or digs (bog iron included) (a
 * basket of mushrooms that still fits keeps a forager working), or a farm's waiting Field work
 * (`farmNoRoom`). Empty for any other building.
 */
export function gathererNoRoom(
  state: GameState,
  content: Content,
  building: EntityId,
): ResourceId[] {
  const b = state.components.building[building];
  if (!b) return [];
  const def = content.buildings[b.type];
  if (def.farm) return farmNoRoom(state, content, building);
  const full = (resource: ResourceId, amount: number) =>
    outputRoom(state, content, building, resource) < amount;
  if (def.hunts) {
    const { catch: bag } = def.hunts;
    return fitsInYard(state, content, building, bag) ? [] : bag.map((c) => c.resource);
  }
  const fish = def.outputBuffer?.resources[0];
  if (def.fishes && fish) return full(fish, def.fishes.yieldPerCatch) ? [fish] : [];
  const yields = new Map<ResourceId, number>();
  for (const type of def.gathers ?? []) {
    const obj = content.mapObjects[type];
    yields.set(obj.resource, Math.max(yields.get(obj.resource) ?? 0, obj.yieldPerGather));
  }
  const ore = def.digsOre ? content.terrain[def.digsOre].ore : undefined;
  if (ore) yields.set(ore.resource, Math.max(yields.get(ore.resource) ?? 0, ore.yieldPerDig));
  const noRoom = [...yields].filter(([resource, amount]) => full(resource, amount));
  return noRoom.length > 0 && noRoom.length === yields.size ? noRoom.map(([r]) => r) : [];
}
