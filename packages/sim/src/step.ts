// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import { heroSystem } from './hero';
import { homesSystem } from './homes';
import type { GameState } from './state';
import { constructionSystem } from './systems/construction';
import { fishingSystem } from './systems/fishing';
import { foragingSystem } from './systems/foraging';
import { haulingSystem } from './systems/hauling';
import { movementSystem } from './systems/movement';
import { patchesSystem } from './systems/patches';
import { productionSystem } from './systems/production';
import { routineSystem } from './systems/routine';
import { spoilageSystem } from './systems/spoilage';
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
 * 4. spoilage: at Dawn, Food in Granaries and workplace buffers loses its daily share
 * 5. patches: at a season's first Dawn, forage patches refill if shaded
 * 6. routine: at Dusk villagers finish what they hold, eat at a Granary and go Home to sleep; at
 *    Dawn back to work
 * 7. hero: works the player's order (chop, pick up, deliver)
 * 8. woodcutting
 * 9. fishing
 * 10. foraging
 * 11. production: workshop crafters take inputs, work, and fill output buffers
 * 12. hauling (job dispatch)
 * 13. construction, by day only
 * 14. staffing: workplaces below their worker limit draft idle carriers
 * then `tick` increments.
 */
export function step(state: GameState, commands: readonly Command[], content: Content): GameState {
  const next = cloneState(state);
  for (const command of commands) applyCommand(next, command, content);
  movementSystem(next, content);
  homesSystem(next, content);
  spoilageSystem(next, content);
  patchesSystem(next, content);
  routineSystem(next, content);
  heroSystem(next, content);
  woodcuttingSystem(next, content);
  fishingSystem(next, content);
  foragingSystem(next, content);
  productionSystem(next, content);
  haulingSystem(next, content);
  constructionSystem(next, content);
  staffingSystem(next, content);
  next.tick += 1;
  return next;
}
