// Immigration. At each Dawn but the first, one Newcomer arrives at the map's entry tile when all
// hold: a House it can walk to has a free place, the Granaries hold `mealsPerHead` Meals for every
// villager plus the Newcomer, and the season isn't closed (winter: the roads are snowed in). It
// gets a name and a Home, walks there, and starts as a Carrier. Runs after this Dawn's deaths, so
// places and mouths they free count.
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { idsOf } from '../entities';
import { villageFood } from '../granary';
import { isVillageUnhappy } from '../happiness';
import { homeDoor, homesSystem, nearestHouseWithRoom } from '../homes';
import type { EntityId, GameState } from '../state';
import { spawnVillager } from '../villagers';
import { walkTo } from './movement';

/** Units of Food the Granaries must hold for a Newcomer to come: 5 Meals a head, its own too. */
export function immigrationFoodNeeded(state: GameState, content: Content): number {
  const population = idsOf(state.components.villager).length;
  return content.immigration.mealsPerHead * content.needs.hungry.mealUnits * (population + 1);
}

/**
 * The House a Newcomer arriving now would live in: the one with a free place nearest the entry by
 * walking cost. Null when immigration is shut: no entry, no such House, too little Food, the
 * villagers' average happiness Unhappy, a closed season, or the game is over (nobody comes to a dead village).
 */
export function newcomerHome(state: GameState, content: Content): EntityId | null {
  const { entry } = state.map;
  if (entry === null || state.gameOver !== null) return null;
  const { season } = calendarAt(state.tick, content);
  if (content.immigration.closedSeasons.includes(season)) return null;
  if (villageFood(state, content) < immigrationFoodNeeded(state, content)) return null;
  if (isVillageUnhappy(state, content)) return null;
  return nearestHouseWithRoom(state, content, entry);
}

export function immigrationSystem(state: GameState, content: Content): void {
  // The game starts at Dawn on day 1; the first Newcomer can come the next Dawn.
  if (!isDawn(state.tick, content) || calendarAt(state.tick, content).day === 1) return;
  const { entry } = state.map;
  if (entry === null) return;
  // Homeless villagers get first pick of places this Dawn's deaths freed.
  homesSystem(state, content);
  const home = newcomerHome(state, content);
  if (home === null) return;

  const id = spawnVillager(state, content, 'carrier', entry, null);
  const v = state.components.villager[id];
  if (!v) return;
  v.home = home;
  const door = homeDoor(state, content, id);
  if (door !== null) walkTo(state, content, id, [door]);
  v.routine = state.components.path[id] ? 'goingHome' : 'work';
}
