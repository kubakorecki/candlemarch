// Advances the simulation by exactly one tick.
import type { Content } from '@candlemarch/content';
import { applyCommand, type Command } from './commands';
import { heroSystem } from './hero';
import { homesSystem } from './homes';
import { inheritMapCache } from './mapCache';
import type { GameState } from './state';
import { chartersSystem } from './systems/charters';
import { combatSystem } from './systems/combat';
import { constructionSystem } from './systems/construction';
import { deliveriesSystem } from './systems/deliveries';
import { densSystem } from './systems/dens';
import { diggingSystem } from './systems/digging';
import { farmingSystem } from './systems/farming';
import { fieldsSystem } from './systems/fields';
import { fishingSystem } from './systems/fishing';
import { fogSystem } from './systems/fog';
import { foragingSystem } from './systems/foraging';
import { forestrySystem } from './systems/forestry';
import { growthSystem } from './systems/growth';
import { haulingSystem } from './systems/hauling';
import { huntingSystem } from './systems/hunting';
import { huntingGroundsSystem } from './systems/huntingGrounds';
import { immigrationSystem } from './systems/immigration';
import { lightsSystem } from './systems/lights';
import { merchantSystem } from './systems/merchants';
import { militiaSystem } from './systems/militia';
import { movementSystem } from './systems/movement';
import { patchesSystem } from './systems/patches';
import { productionSystem } from './systems/production';
import { renewalSystem } from './systems/renewal';
import { routineSystem } from './systems/routine';
import { spoilageSystem } from './systems/spoilage';
import { staffingSystem } from './systems/staffing';
import { toolsSystem } from './systems/tools';
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
  inheritMapCache(state, next);
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
 * 5. growth: at Dawn, Saplings move on a drawing stage or grow into trees (before patches, so a
 *    tree grown this Dawn already shades them)
 * 6. hunting grounds: at Dawn, Game comes back to grounds under their ceiling or emptied long
 *    enough (after growth, so a tree grown this Dawn already raises the ceiling)
 * 7. patches: at a season's first Dawn, forage patches refill if shaded
 * 8. renewal: at spring's first Dawn, clay Deposits regain a share of their amount, bog iron
 *    comes back and Fields throw up Fieldstones (PRNG)
 * 9. fields: at Dawn, sown Fields whose time has come are ripe; at winter's first Dawn whatever
 *    stands on them is lost; at spring's first Dawn each farm's picked Crop becomes this year's
 * 10. merchants: at Dawn, prices recover, a Merchant here leaves (the next Wanted list drawn,
 *    PRNG) and on a Merchant day one arrives and buys the trade post's Storage
 * 11. deliveries: at Dawn, a Delivery order past its deadline fails, and with none up and a
 *    notice board standing the next is posted (PRNG), a few days after the last closed
 * 12. charters: at Dawn, Charters whose 10 days are up are withdrawn, and with a notice board
 *    standing the board is filled up to 2 with Masters of trades the village lacks (PRNG)
 * 13. warmth: at a winter Dusk, Houses burn firewood or go cold; at Dawn, villagers count the
 *    night as warm or cold
 * 14. lights: at every Dusk torches and braziers burn their night's firewood and are lit, or
 *    stay dark; at Dawn they go out
 * 15. tools: at Dusk every tool a worker held counts a day worked; worn out, it's gone
 * 16. routine: at Dusk villagers finish what they hold, eat at a Granary and go Home to sleep; at
 *    Dawn back to work (or starve, a Meal too many missed). Watchmen go to their towers after
 *    the Meal and sleep at Home by day
 * 17. immigration: at Dawn, after its deaths, maybe one Newcomer arrives at the entry tile
 * 18. dens: at Dawn Gloamlings vanish and, at a season's first Dawn, Dens bud (PRNG); at Dusk Dens
 *    spawn Gloamlings; at Monster rate 0 Gloamlings vanish at once
 * 19. militia: while the bell rings, the villagers it called walk after Gloamlings near it, or
 *    to it; at Dawn they stand down
 * 20. combat: Gloamlings pick targets out of Light and walk after them, around lit tiles;
 *    villagers they reach drop their work and fight back, the militia hits Gloamlings near the
 *    bell, a watchtower with its Watchman in it shoots the nearest in range; hits in entity-ID
 *    order; villagers back to full HP at Dawn
 * 21. hero: works the player's order (chop, pick up, deliver)
 * 22. woodcutting
 * 23. fishing
 * 24. foraging
 * 25. hunting: hunters roll for a catch with the PRNG
 * 26. forestry: foresters plant Saplings
 * 27. digging: quarrymen, clay diggers and miners dig Deposits
 * 28. farming: farmers clear Fieldstones, sow and harvest Fields
 * 29. production: workshop crafters take inputs, work, and fill output buffers
 * 30. hauling (job dispatch)
 * 31. construction, by day only
 * 32. staffing: workplaces below their worker limit draft idle carriers
 * 33. fog: while Fog is on, the tiles In sight are worked out again when a source moved to
 *    another tile or its reach changed, and are Revealed for good
 * 34. traffic: counts Carriers at work and those holding a Haul (movement counts road steps)
 * then `tick` increments.
 */
export function stepInPlace(next: GameState, commands: readonly Command[], content: Content): void {
  for (const command of commands) applyCommand(next, command, content);
  movementSystem(next, content);
  homesSystem(next, content);
  spoilageSystem(next, content);
  growthSystem(next, content);
  huntingGroundsSystem(next, content);
  patchesSystem(next, content);
  renewalSystem(next, content);
  fieldsSystem(next, content);
  merchantSystem(next, content);
  deliveriesSystem(next, content);
  chartersSystem(next, content);
  warmthSystem(next, content);
  lightsSystem(next, content);
  toolsSystem(next, content);
  routineSystem(next, content);
  immigrationSystem(next, content);
  densSystem(next, content);
  militiaSystem(next, content);
  combatSystem(next, content);
  heroSystem(next, content);
  woodcuttingSystem(next, content);
  fishingSystem(next, content);
  foragingSystem(next, content);
  huntingSystem(next, content);
  forestrySystem(next, content);
  diggingSystem(next, content);
  farmingSystem(next, content);
  productionSystem(next, content);
  haulingSystem(next, content);
  constructionSystem(next, content);
  staffingSystem(next, content);
  fogSystem(next, content);
  trafficSystem(next, content);
  next.tick += 1;
}
