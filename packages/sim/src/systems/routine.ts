// The daily routine. At Dusk villagers finish what they hold, eat a Meal at the nearest Granary
// with Food, walk Home and sleep; Homeless ones sleep where they stand. At Dawn they go back to
// work, Tired if they slept less than half the night at Home, Hungry if they missed the Meal. A
// villager missing its third Meal in a row starves then. A Newcomer walks Home by day, then works.
// A Watchman works the night shift instead: after its Meal it walks to its watchtower and stands in
// it until Dawn, then walks Home and sleeps there by day; it's Tired at Dusk if it slept less than
// half the day at Home. The hero isn't a villager: it ignores night and never eats.
import type { Content } from '@candlemarch/content';
import { calendarAt, dawnTick, duskTick, isDawn, isDusk, isNight } from '../calendar';
import { killVillager } from '../deaths';
import { idsOf } from '../entities';
import { nearestGranaryWithMeal, takeMeal } from '../granary';
import { entityDoor } from '../grid';
import { isLeaving } from '../happiness';
import { homeDoor, isAtHome } from '../homes';
import { abandonHaul } from '../logistics/jobDispatch';
import type { EntityId, GameState } from '../state';
import { isOnWatch, isWatchman, towerDoor } from '../watchtowers';
import { isAt, rerouteTo, stopAtNextTile } from './movement';

/**
 * Ends villager `id`'s working day, after Dusk: drops what can't be finished and returns whether
 * it's still finishing something. A Carrier with goods in hand delivers them (or brings them
 * back); one walking to a pickup drops the Haul. A woodcutter carrying logs takes them to its
 * Workplace; a chop, or the walk to a tree, is abandoned. A forager does the same with Food and
 * forage patches, a digger with what it dug and Deposits, a farmer with a harvest or Fieldstone and its Field, and a hunter with its bag (full or empty): a hunt under way is abandoned, and
 * so is a forester's planting. A crafter finishes a batch under way; a fisher's catch under way
 * is lost.
 */
function finishWork(state: GameState, id: EntityId): boolean {
  const { woodcutter, crafter, fisher, forager, hunter, forester, digger, farmer } =
    state.components;
  const haul = state.logistics.hauls[id];
  if (haul?.phase === 'pickup') abandonHaul(state, id);
  else if (haul) return true;

  const chop = woodcutter[id];
  if (chop?.kind === 'toHut') return true;
  if (chop && chop.kind !== 'idle') woodcutter[id] = { kind: 'idle', retryAt: state.tick };
  const forage = forager[id];
  if (forage?.kind === 'toHut') return true;
  if (forage && forage.kind !== 'idle') forager[id] = { kind: 'idle', retryAt: state.tick };
  const dig = digger[id];
  if (dig?.kind === 'toYard') return true;
  if (dig && dig.kind !== 'idle') digger[id] = { kind: 'idle', retryAt: state.tick };
  const farm = farmer[id];
  if (farm?.kind === 'toYard') return true;
  if (farm && farm.kind !== 'idle') farmer[id] = { kind: 'idle', retryAt: state.tick };
  const hunt = hunter[id];
  if (hunt?.kind === 'toLodge') return true;
  if (hunt && hunt.kind !== 'idle') hunter[id] = { kind: 'idle', retryAt: state.tick };
  const plant = forester[id];
  if (plant && plant.kind !== 'idle') forester[id] = { kind: 'idle', retryAt: state.tick };
  if (crafter[id]?.kind === 'working') return true;
  if (fisher[id]?.kind === 'fishing') fisher[id] = { kind: 'idle', retryAt: state.tick };
  return false;
}

/** Sends villager `id` Home, or to sleep where it stands when it's Homeless or can't get there. */
function goHome(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  const door = homeDoor(state, content, id);
  if (door !== null && rerouteTo(state, content, id, [door])) {
    v.routine = state.components.path[id] ? 'goingHome' : 'asleep';
    return;
  }
  stopAtNextTile(state, id);
  v.routine = 'asleep';
}

/**
 * After its Meal: a Watchman walks to its watchtower and stands in it (`onWatch`); anyone else,
 * or a Watchman that can't get to its tower, goes Home.
 */
function afterMeal(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  const door = isWatchman(v) ? towerDoor(state, content, id) : null;
  if (door !== null && rerouteTo(state, content, id, [door])) {
    v.routine = state.components.path[id] ? 'toTower' : 'onWatch';
    return;
  }
  goHome(state, content, id);
}

/**
 * Villager `id`'s Meal, on the way home after Dusk: walks to the nearest Granary with Food, eats
 * there once at its door, then goes Home. With no Granary to eat at, it goes Home Hungry, or
 * starves if that was one Meal too many.
 */
function seekMeal(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  const granary = nearestGranaryWithMeal(state, content, id);
  const door = granary === null ? null : entityDoor(state, content, granary);
  if (granary !== null && door !== null) {
    if (isAt(state, id, door)) {
      takeMeal(state, content, granary);
      v.missedMeals = 0;
      afterMeal(state, content, id);
      return;
    }
    if (rerouteTo(state, content, id, [door])) {
      v.routine = 'toGranary';
      return;
    }
  }
  if (missMeal(state, content, id)) return;
  afterMeal(state, content, id);
}

/**
 * Counts a Meal missed by villager `id`. Returns true if that was one too many in a row and it
 * starved.
 */
function missMeal(state: GameState, content: Content, id: EntityId): boolean {
  const v = state.components.villager[id];
  if (!v) return false;
  v.missedMeals += 1;
  if (v.missedMeals < content.needs.hungry.starveAfterMissedMeals) return false;
  killVillager(state, content, id, 'starvation');
  return true;
}

/** Ticks of the night that ended at the Dawn of day `day`. */
function lastNightTicks(day: number, content: Content): number {
  return dawnTick(day, content) - duskTick(day - 1, content);
}

/** Ticks of daylight on day `day`, from its Dawn to its Dusk. */
function dayTicks(day: number, content: Content): number {
  return duskTick(day, content) - dawnTick(day, content);
}

/**
 * Watchman `id` by day: walks Home and sleeps there until Dusk, counting its sleep, or sleeps
 * where it stands when it's Homeless or can't get there.
 */
function sleepByDay(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  switch (v.routine) {
    case 'goingHome': {
      if (state.components.path[id]) break;
      if (isAtHome(state, content, id)) v.routine = 'asleep';
      else goHome(state, content, id); // the walk was cut short, or the Home is gone
      break;
    }
    case 'asleep': {
      if (isAtHome(state, content, id)) v.sleptTicks += 1;
      break;
    }
    default:
      goHome(state, content, id);
  }
}

export function routineSystem(state: GameState, content: Content): void {
  const { villager, path } = state.components;
  const { day } = calendarAt(state.tick, content);
  const dusk = isDusk(state.tick, content);
  // The game starts at Dawn on day 1, after no night.
  const dawn = isDawn(state.tick, content) && day > 1;
  const night = isNight(state.tick, content);
  const { minSleepPercent } = content.needs.tired;

  for (const id of idsOf(villager)) {
    const v = villager[id];
    // Leaving the village (`systems/happiness.ts`): it has no routine left.
    if (!v || isLeaving(v)) continue;
    const watchman = isWatchman(v);
    if (dusk && watchman) {
      // Wakes for its shift, Tired if it slept too little at Home by day.
      v.tired = v.sleptTicks * 100 < dayTicks(day, content) * minSleepPercent;
      v.sleptTicks = 0;
      v.routine = 'work';
    } else if (dusk) {
      v.tired = false;
    }
    if (dawn) {
      v.tired = watchman
        ? false
        : v.sleptTicks * 100 < lastNightTicks(day, content) * minSleepPercent;
      v.sleptTicks = 0;
      // Still at work or on the way to a Granary: the night passed without a Meal.
      if ((v.routine === 'work' || v.routine === 'toGranary') && missMeal(state, content, id)) {
        continue;
      }
      if (v.routine !== 'work') {
        v.routine = 'work';
        stopAtNextTile(state, id); // one still walking home turns back from the next tile
      }
    }
    if (!night) {
      if (watchman) sleepByDay(state, content, id);
      // A Newcomer walks to its new Home by day, then starts work. One that stopped being a
      // Watchman gets up and starts work.
      else if (v.routine === 'goingHome' ? !path[id] : v.routine !== 'work') v.routine = 'work';
      continue;
    }

    // Standing its ground against a Gloamling (`systems/combat.ts`), or called to arms by the
    // Militia bell (`militia.ts`): its routine waits.
    if (v.fighting || v.militia) continue;
    switch (v.routine) {
      case 'work': {
        if (!finishWork(state, id)) seekMeal(state, content, id);
        break;
      }
      case 'toGranary': {
        // Arrived, or the walk was cut short: eat here, or find the nearest Food again.
        if (!path[id]) seekMeal(state, content, id);
        break;
      }
      case 'goingHome': {
        if (path[id]) break;
        if (isAtHome(state, content, id)) v.routine = 'asleep';
        else goHome(state, content, id); // the walk was cut short, or the Home is gone
        break;
      }
      case 'asleep': {
        if (isAtHome(state, content, id)) v.sleptTicks += 1;
        break;
      }
      case 'toTower': {
        // Arrived, or the walk was cut short: stand in, or head there again.
        if (path[id]) break;
        const door = towerDoor(state, content, id);
        if (door !== null && isAt(state, id, door)) v.routine = 'onWatch';
        else afterMeal(state, content, id);
        break;
      }
      case 'onWatch': {
        // The tower is gone, or it's no longer a Watchman: back Home.
        if (!isOnWatch(state, content, id)) afterMeal(state, content, id);
        break;
      }
    }
  }
}
