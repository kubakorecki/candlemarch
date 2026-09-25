// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import type { GameState } from './state';
import { constructionSystem } from './systems/construction';
import { haulingSystem } from './systems/hauling';
import { movementSystem } from './systems/movement';
import { staffingSystem } from './systems/staffing';
import { woodcuttingSystem } from './systems/woodcutting';

/** Deep copy of plain-data state. Doubles as a guard that state stays JSON-serializable. */
function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * Returns the state one tick later. Doesn't mutate `state`. Fixed order:
 * 1. commands, in array order
 * 2. movement: walkers advance; arrivals are visible to the systems below this same tick
 * 3. woodcutting
 * 4. hauling (the game's logistics model)
 * 5. construction
 * 6. staffing: finished or understaffed workplaces draft idle carriers
 * then `tick` increments.
 */
export function step(state: GameState, commands: readonly Command[], content: Content): GameState {
  const next = cloneState(state);
  for (const command of commands) applyCommand(next, command, content);
  movementSystem(next, content);
  woodcuttingSystem(next, content);
  haulingSystem(next, content);
  constructionSystem(next, content);
  staffingSystem(next, content);
  next.tick += 1;
  return next;
}
