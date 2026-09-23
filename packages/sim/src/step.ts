// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import type { GameState } from './state';

/** Deep copy of plain-data state. Doubles as a guard that state stays JSON-serializable. */
function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * Returns the state one tick later. Doesn't mutate `state`. Order:
 * 1. commands, in array order
 */
export function step(state: GameState, commands: readonly Command[], content: Content): GameState {
  const next = cloneState(state);
  for (const command of commands) applyCommand(next, command, content);
  next.tick += 1;
  return next;
}
