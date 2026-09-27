// Save files are the serialized game state.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { createEmptyState } from './map';
import { type Components, type GameState, type MapState, STATE_VERSION } from './state';
import { fallbackVillagerName } from './villagers';

/** A save of the current version, which may lack state added after it was made. */
type LoadedState = Partial<Omit<GameState, 'components' | 'map'>> & {
  components?: Partial<Components>;
  map?: Partial<MapState>;
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string, content: Content): GameState {
  const data: unknown = JSON.parse(json);
  const version = (data as { version?: unknown } | null)?.version;
  if (version !== STATE_VERSION) {
    throw new Error(`Unsupported save version ${String(version)}; expected ${STATE_VERSION}`);
  }
  return normalizeLoadedState(data as LoadedState, content);
}

/**
 * Fills in state added after the save was made: missing top-level fields, map layers (such as
 * `roads`) and component stores come from an empty state. A field added inside an existing
 * component gets its own line here.
 * Breaking changes (renames, removals, changed meanings) bump `STATE_VERSION` instead.
 */
function normalizeLoadedState(loaded: LoadedState, content: Content): GameState {
  const empty = createEmptyState(0);
  const state: GameState = {
    ...empty,
    ...loaded,
    map: { ...empty.map, ...loaded.map },
    components: { ...empty.components, ...loaded.components },
  };
  for (const pile of Object.values(state.components.stockpile)) {
    pile.priority ??= 'normal';
    pile.refuses ??= [];
  }
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v) v.name ??= fallbackVillagerName(id, content);
  }
  for (const hero of Object.values(state.components.hero)) {
    hero.carrying ??= null;
    hero.order ??= null;
  }
  return state;
}
