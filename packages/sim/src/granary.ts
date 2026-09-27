// Granaries: the buildings that store Food (in their `stock`), and where villagers eat a Meal.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor, tileIndex } from './grid';
import { travelCosts } from './pathfinding';
import type { EntityId, GameState } from './state';
import { villagerTile, walkGrid } from './systems/movement';

/** Whether `resource` is Food: stored in Granaries, never on Stockpiles. */
export function isFood(content: Content, resource: ResourceId): boolean {
  return content.resources[resource]?.storage === 'granary';
}

/** Food resource IDs in content order. */
export function foodIds(content: Content): ResourceId[] {
  return (Object.keys(content.resources) as ResourceId[]).filter((r) => isFood(content, r));
}

/** Whether `building` is a Granary. */
export function isGranary(state: GameState, content: Content, building: EntityId): boolean {
  const b = state.components.building[building];
  return b !== undefined && content.buildings[b.type].foodCapacity !== undefined;
}

/** Units of Food, all Foods together, Granary `granary` holds. */
export function foodIn(state: GameState, content: Content, granary: EntityId): number {
  const b = state.components.building[granary];
  if (!b) return 0;
  let total = 0;
  for (const resource of foodIds(content)) total += b.stock[resource] ?? 0;
  return total;
}

/**
 * Units of Food Granary `granary` still has room for, all Foods together (not counting anything on
 * its way), or 0 if it isn't a Granary.
 */
export function granaryRoom(state: GameState, content: Content, granary: EntityId): number {
  const b = state.components.building[granary];
  const capacity = b ? content.buildings[b.type].foodCapacity : undefined;
  if (capacity === undefined) return 0;
  return Math.max(0, capacity - foodIn(state, content, granary));
}

/** Units of Food, all Foods together, in every Granary of the village. */
export function villageFood(state: GameState, content: Content): number {
  let total = 0;
  for (const id of idsOf(state.components.building)) {
    if (isGranary(state, content, id)) total += foodIn(state, content, id);
  }
  return total;
}

/** Foods in the order villagers eat them: by resource ID. */
export function eatingOrder(content: Content): ResourceId[] {
  return foodIds(content).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Whether Granary `granary` holds at least one Meal. */
export function hasMeal(state: GameState, content: Content, granary: EntityId): boolean {
  return foodIn(state, content, granary) >= content.needs.hungry.mealUnits;
}

/**
 * Takes one Meal out of Granary `granary`: `mealUnits` of Food, in eating order. Returns false,
 * taking nothing, if it holds less than a Meal.
 */
export function takeMeal(state: GameState, content: Content, granary: EntityId): boolean {
  const b = state.components.building[granary];
  if (!b || !hasMeal(state, content, granary)) return false;
  let left = content.needs.hungry.mealUnits;
  for (const resource of eatingOrder(content)) {
    const taken = Math.min(left, b.stock[resource] ?? 0);
    if (taken <= 0) continue;
    b.stock[resource] = (b.stock[resource] ?? 0) - taken;
    left -= taken;
    if (left === 0) break;
  }
  return true;
}

/**
 * The Granary holding a Meal nearest to villager `id` by walking cost, ties to the lowest ID, or
 * null if it can walk to none.
 */
export function nearestGranaryWithMeal(
  state: GameState,
  content: Content,
  id: EntityId,
): EntityId | null {
  const here = villagerTile(state, id);
  if (!here) return null;
  const granaries = idsOf(state.components.building).filter(
    (g) => isGranary(state, content, g) && hasMeal(state, content, g),
  );
  if (granaries.length === 0) return null;
  const costs = travelCosts(walkGrid(state, content), tileIndex(state.map, here.x, here.y));
  let best: { granary: EntityId; cost: number } | null = null;
  for (const granary of granaries) {
    const door = entityDoor(state, content, granary);
    const cost = door
      ? (costs[tileIndex(state.map, door.x, door.y)] as number)
      : Number.POSITIVE_INFINITY;
    if (cost !== Number.POSITIVE_INFINITY && (!best || cost < best.cost)) best = { granary, cost };
  }
  return best?.granary ?? null;
}
