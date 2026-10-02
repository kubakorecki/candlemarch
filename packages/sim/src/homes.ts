// Homes: the House each villager lives in. Homeless villagers are given a free place
// automatically; nobody is moved once housed, and there's no manual assignment yet.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor, tileIndex } from './grid';
import { isLeaving } from './happiness';
import type { EntityId, GameState, Tile } from './state';
import { isAt, villagerTile, walkCosts } from './systems/movement';

/** Places a House has, or 0 when `building` isn't a House (or doesn't exist). */
export function housePlaces(state: GameState, content: Content, building: EntityId): number {
  const b = state.components.building[building];
  return b ? (content.buildings[b.type].residents ?? 0) : 0;
}

/** Door of villager `id`'s Home, or null when it's Homeless. */
export function homeDoor(state: GameState, content: Content, id: EntityId): Tile | null {
  const home = state.components.villager[id]?.home ?? null;
  if (home === null || housePlaces(state, content, home) === 0) return null;
  return entityDoor(state, content, home);
}

/** Whether villager `id` stands at its Home's door, which is where it sleeps. */
export function isAtHome(state: GameState, content: Content, id: EntityId): boolean {
  const door = homeDoor(state, content, id);
  return door !== null && isAt(state, id, door);
}

/** Villagers whose Home is `house`, in ID order. */
export function residentsOf(state: GameState, house: EntityId): EntityId[] {
  const { villager } = state.components;
  return idsOf(villager).filter((id) => villager[id]?.home === house);
}

/** Free places in each House, by House ID; full Houses included, at 0. */
function freePlaces(state: GameState, content: Content): Record<EntityId, number> {
  const free: Record<EntityId, number> = {};
  for (const house of idsOf(state.components.building)) {
    const places = housePlaces(state, content, house);
    if (places > 0) free[house] = places - residentsOf(state, house).length;
  }
  return free;
}

/**
 * The House with a free place in `free` nearest `from` by walking cost, ties to the
 * lowest ID, or null when none can be walked to.
 */
function nearestFree(
  state: GameState,
  content: Content,
  from: Tile,
  free: Record<EntityId, number>,
): EntityId | null {
  const costs = walkCosts(state, content, tileIndex(state.map, from.x, from.y));
  let best: { house: EntityId; cost: number } | null = null;
  for (const house of idsOf(free)) {
    if ((free[house] ?? 0) <= 0) continue;
    const door = entityDoor(state, content, house);
    const cost = door
      ? costs.costTo(tileIndex(state.map, door.x, door.y))
      : Number.POSITIVE_INFINITY;
    if (cost !== Number.POSITIVE_INFINITY && (!best || cost < best.cost)) best = { house, cost };
  }
  return best?.house ?? null;
}

/**
 * The House with a free place nearest `from` by walking cost, ties to the lowest ID, or null when
 * no House with room can be walked to from there.
 */
export function nearestHouseWithRoom(
  state: GameState,
  content: Content,
  from: Tile,
): EntityId | null {
  return nearestFree(state, content, from, freePlaces(state, content));
}

/**
 * Keeps Homes up to date. Residents of a House that's gone become Homeless. Then every Homeless
 * villager, in ID order, gets a free place in the House nearest by walking cost to its
 * Workplace's door (a Carrier: to where it stands), ties to the lowest House ID. A villager no
 * House with room can be walked to stays Homeless.
 */
export function homesSystem(state: GameState, content: Content): void {
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v && v.home !== null && housePlaces(state, content, v.home) === 0) v.home = null;
  }

  const free = freePlaces(state, content);
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || v.home !== null || isLeaving(v)) continue;
    if (!idsOf(free).some((h) => (free[h] ?? 0) > 0)) return;
    const from =
      v.workplace !== null ? entityDoor(state, content, v.workplace) : villagerTile(state, id);
    if (!from) continue;
    const house = nearestFree(state, content, from, free);
    if (house === null) continue;
    v.home = house;
    free[house] = (free[house] ?? 0) - 1;
  }
}
