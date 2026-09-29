// Entity bookkeeping over the component stores.
import { mapChanged } from './mapCache';
import { staticChanged } from './snapshot';
import type { Components, EntityId, GameState, Store } from './state';

/** A new entity ID. Counts as a map change: the entity may be given a `tile` next. */
export function createEntity(state: GameState): EntityId {
  const id = state.nextId;
  state.nextId += 1;
  mapChanged(state);
  return id;
}

/**
 * Removes every component of an entity. Removing one that stood on a tile changes the map;
 * removing a map object changes a static layer too.
 */
export function destroyEntity(state: GameState, id: EntityId): void {
  if (state.components.tile[id]) mapChanged(state);
  if (state.components.mapObject[id]) staticChanged(state);
  for (const key of Object.keys(state.components) as (keyof Components)[]) {
    delete state.components[key][id];
  }
}

/**
 * Entity IDs in a store, in ascending order. Iterate with this wherever order matters.
 * No sort needed: IDs are positive integers, and JavaScript lists an object's integer keys in
 * ascending order whatever order they were added in (and JSON keeps that).
 */
export function idsOf<T>(store: Store<T>): EntityId[] {
  const keys = Object.keys(store);
  const ids: EntityId[] = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) ids[i] = Number(keys[i]);
  return ids;
}
