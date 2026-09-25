// Save files are the serialized game state.
import { createEmptyState } from './map';
import { type Components, type GameState, STATE_VERSION } from './state';

/** A save of the current version, which may lack state added after it was made. */
type LoadedState = Partial<Omit<GameState, 'components'>> & { components?: Partial<Components> };

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const data: unknown = JSON.parse(json);
  const version = (data as { version?: unknown } | null)?.version;
  if (version !== STATE_VERSION) {
    throw new Error(`Unsupported save version ${String(version)}; expected ${STATE_VERSION}`);
  }
  return normalizeLoadedState(data as LoadedState);
}

/**
 * Fills in state added after the save was made: missing top-level fields and component stores
 * come from an empty state. A field added inside an existing component gets its own line here.
 * Breaking changes (renames, removals, changed meanings) bump `STATE_VERSION` instead.
 */
function normalizeLoadedState(loaded: LoadedState): GameState {
  const empty = createEmptyState(0);
  const state: GameState = {
    ...empty,
    ...loaded,
    components: { ...empty.components, ...loaded.components },
  };
  return state;
}
