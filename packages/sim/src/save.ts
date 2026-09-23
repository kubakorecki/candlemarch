// Save files are the serialized game state.
import { type GameState, STATE_VERSION } from './state';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const data: unknown = JSON.parse(json);
  const version = (data as { version?: unknown } | null)?.version;
  if (version !== STATE_VERSION) {
    throw new Error(`Unsupported save version ${String(version)}; expected ${STATE_VERSION}`);
  }
  return data as GameState;
}
