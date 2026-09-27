// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import { heroSystem } from './hero';
import { homesSystem } from './homes';
import type { GameState } from './state';
import { constructionSystem } from './systems/construction';
import { fishingSystem } from './systems/fishing';
import { haulingSystem } from './systems/hauling';
import { movementSystem } from './systems/movement';
import { productionSystem } from './systems/production';
import { routineSystem } from './systems/routine';
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
 * 3. homes: Homeless villagers get a free place in a House
 * 4. routine: at Dusk villagers finish what they hold and go Home to sleep; at Dawn back to work
 * 5. hero: works the player's order (chop, pick up, deliver)
 * 6. woodcutting
 * 7. fishing
 * 8. production: workshop crafters take inputs, work, and fill output buffers
 * 9. hauling (job dispatch)
 * 10. construction, by day only
 * 11. staffing: workplaces below their worker limit draft idle carriers
 * then `tick` increments.
 */
export function step(state: GameState, commands: readonly Command[], content: Content): GameState {
  const next = cloneState(state);
  for (const command of commands) applyCommand(next, command, content);
  movementSystem(next, content);
  homesSystem(next, content);
  routineSystem(next, content);
  heroSystem(next, content);
  woodcuttingSystem(next, content);
  fishingSystem(next, content);
  productionSystem(next, content);
  haulingSystem(next, content);
  constructionSystem(next, content);
  staffingSystem(next, content);
  next.tick += 1;
  return next;
}
