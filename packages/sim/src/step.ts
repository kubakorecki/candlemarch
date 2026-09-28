// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import { heroSystem } from './hero';
import { homesSystem } from './homes';
import type { GameState } from './state';
import { combatSystem } from './systems/combat';
import { constructionSystem } from './systems/construction';
import { densSystem } from './systems/dens';
import { fishingSystem } from './systems/fishing';
import { foragingSystem } from './systems/foraging';
import { haulingSystem } from './systems/hauling';
import { huntingSystem } from './systems/hunting';
import { immigrationSystem } from './systems/immigration';
import { lightsSystem } from './systems/lights';
import { movementSystem } from './systems/movement';
import { patchesSystem } from './systems/patches';
import { productionSystem } from './systems/production';
import { routineSystem } from './systems/routine';
import { spoilageSystem } from './systems/spoilage';
import { staffingSystem } from './systems/staffing';
import { trafficSystem } from './systems/traffic';
import { warmthSystem } from './systems/warmth';
import { woodcuttingSystem } from './systems/woodcutting';

/** Deep copy of plain-data state. Doubles as a guard that state stays JSON-serializable. */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Returns the state one tick later. Doesn't mutate `state`. See `stepInPlace` for the order. */
export function step(state: GameState, commands: readonly Command[], content: Content): GameState {
  const next = cloneState(state);
  stepInPlace(next, commands, content);
  return next;
}

/**
 * Advances `state` itself by one tick, skipping `step`'s copy. For long headless runs that own
 * their state (balance scenarios, test helpers); the result is the same as `step`'s. Fixed order:
 * 1. commands, in array order
 * 2. movement: walkers advance; arrivals are visible to the systems below this same tick
 * 3. homes: Homeless villagers get a free place in a House
 * 4. spoilage: at Dawn, Food in Granaries and workplace buffers loses its daily share
 * 5. patches: at a season's first Dawn, forage patches refill if shaded
 * 6. warmth: at a winter Dusk, Houses burn firewood or go cold; at Dawn, villagers count the
 *    night as warm or cold
 * 7. lights: at every Dusk torches and braziers burn their night's firewood and are lit, or
 *    stay dark; at Dawn they go out
 * 8. routine: at Dusk villagers finish what they hold, eat at a Granary and go Home to sleep; at
 *    Dawn back to work (or starve, a Meal too many missed)
 * 9. immigration: at Dawn, after its deaths, maybe one Newcomer arrives at the entry tile
 * 10. dens: at Dawn Gloamlings vanish and, at a season's first Dawn, Dens bud (PRNG); at Dusk Dens
 *    spawn Gloamlings; at Monster rate 0 Gloamlings vanish at once
 * 11. combat: Gloamlings pick targets out of Light and walk after them, around lit tiles;
 *    villagers they reach drop their work and fight back; hits in entity-ID order; villagers
 *    back to full HP at Dawn
 * 12. hero: works the player's order (chop, pick up, deliver)
 * 13. woodcutting
 * 14. fishing
 * 15. foraging
 * 16. hunting: hunters roll for a catch with the PRNG
 * 17. production: workshop crafters take inputs, work, and fill output buffers
 * 18. hauling (job dispatch)
 * 19. construction, by day only
 * 20. staffing: workplaces below their worker limit draft idle carriers
 * 21. traffic: counts Carriers at work and those holding a Haul (movement counts road steps)
 * then `tick` increments.
 */
export function stepInPlace(next: GameState, commands: readonly Command[], content: Content): void {
  for (const command of commands) applyCommand(next, command, content);
  movementSystem(next, content);
  homesSystem(next, content);
  spoilageSystem(next, content);
  patchesSystem(next, content);
  warmthSystem(next, content);
  lightsSystem(next, content);
  routineSystem(next, content);
  immigrationSystem(next, content);
  densSystem(next, content);
  combatSystem(next, content);
  heroSystem(next, content);
  woodcuttingSystem(next, content);
  fishingSystem(next, content);
  foragingSystem(next, content);
  huntingSystem(next, content);
  productionSystem(next, content);
  haulingSystem(next, content);
  constructionSystem(next, content);
  staffingSystem(next, content);
  trafficSystem(next, content);
  next.tick += 1;
}
