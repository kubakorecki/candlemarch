// Homes: the House each villager lives in. Homeless villagers are given a free place
// automatically; nobody is moved once housed, and there's no manual assignment yet.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor, tileIndex } from './grid';
import { type Grid, travelCosts } from './pathfinding';
import type { EntityId, GameState } from './state';
import { villagerTile, walkGrid } from './systems/movement';

/** Places a House has, or 0 when `building` isn't a House (or doesn't exist). */
export function housePlaces(state: GameState, content: Content, building: EntityId): number {
  const b = state.components.building[building];
  return b ? (content.buildings[b.type].residents ?? 0) : 0;
}

/** Villagers whose Home is `house`, in ID order. */
export function residentsOf(state: GameState, house: EntityId): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.home === house);
}

/**
 * Keeps Homes up to date. Residents of a House that's gone become Homeless. Then every Homeless
 * villager, in ID order, gets a free place in the House nearest by walking cost to its
 * Workplace's door (a Carrier: to where it stands), ties to the lowest House ID. A villager no
 * House with room can be walked to stays Homeless.
 */
export function homesSystem(state: GameState, content: Content): void {
  const { villager, building } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v && v.home !== null && housePlaces(state, content, v.home) === 0) v.home = null;
  }

  const free: Record<EntityId, number> = {};
  for (const house of idsOf(building)) {
    const places = housePlaces(state, content, house);
    if (places > 0) free[house] = places - residentsOf(state, house).length;
  }
  const houses = idsOf(free);

  let grid: Grid | null = null;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || v.home !== null) continue;
    const open = houses.filter((h) => (free[h] ?? 0) > 0);
    if (open.length === 0) return;
    const from =
      v.workplace !== null ? entityDoor(state, content, v.workplace) : villagerTile(state, id);
    if (!from) continue;
    grid ??= walkGrid(state, content);
    const costs = travelCosts(grid, tileIndex(state.map, from.x, from.y));
    let best: { house: EntityId; cost: number } | null = null;
    for (const house of open) {
      const door = entityDoor(state, content, house);
      const cost = door
        ? (costs[tileIndex(state.map, door.x, door.y)] as number)
        : Number.POSITIVE_INFINITY;
      if (cost !== Number.POSITIVE_INFINITY && (!best || cost < best.cost)) best = { house, cost };
    }
    if (!best) continue;
    v.home = best.house;
    free[best.house] = (free[best.house] ?? 0) - 1;
  }
}
