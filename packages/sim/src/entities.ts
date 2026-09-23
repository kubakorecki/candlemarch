// Entity bookkeeping over the component stores.
import type { Components, EntityId, GameState, Store } from './state';

export function createEntity(state: GameState): EntityId {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

/** Removes every component of an entity. */
export function destroyEntity(state: GameState, id: EntityId): void {
  for (const key of Object.keys(state.components) as (keyof Components)[]) {
    delete state.components[key][id];
  }
}

/** Entity IDs in a store, in ascending order. Iterate with this wherever order matters. */
export function idsOf<T>(store: Store<T>): EntityId[] {
  return Object.keys(store)
    .map(Number)
    .sort((a, b) => a - b);
}
