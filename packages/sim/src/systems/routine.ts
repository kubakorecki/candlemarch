// The daily routine. At Dusk villagers finish what they hold, walk Home and sleep; Homeless ones
// sleep where they stand. At Dawn they go back to work, Tired if they slept less than half the
// night at Home. The hero isn't a villager and ignores night.
import type { Content } from '@candlemarch/content';
import { calendarAt, dawnTick, duskTick, isDawn, isDusk, isNight } from '../calendar';
import { idsOf } from '../entities';
import { entityDoor } from '../grid';
import { housePlaces } from '../homes';
import { abandonHaul } from '../logistics/jobDispatch';
import type { EntityId, GameState, Tile } from '../state';
import { isAt, rerouteTo, stopAtNextTile } from './movement';

/** Door of villager `id`'s Home, or null when it's Homeless. */
function homeDoor(state: GameState, content: Content, id: EntityId): Tile | null {
  const home = state.components.villager[id]?.home ?? null;
  if (home === null || housePlaces(state, content, home) === 0) return null;
  return entityDoor(state, content, home);
}

/** Whether villager `id` stands at its Home's door, which is where it sleeps. */
function isAtHome(state: GameState, content: Content, id: EntityId): boolean {
  const door = homeDoor(state, content, id);
  return door !== null && isAt(state, id, door);
}

/**
 * Ends villager `id`'s working day, after Dusk: drops what can't be finished and returns whether
 * it's still finishing something. A Carrier with goods in hand delivers them (or brings them
 * back); one walking to a pickup drops the Haul. A woodcutter carrying logs takes them to its
 * Workplace; a chop, or the walk to a tree, is abandoned. A crafter finishes a batch under way; a
 * fisher's catch under way is lost.
 */
function finishWork(state: GameState, id: EntityId): boolean {
  const { woodcutter, crafter, fisher } = state.components;
  const haul = state.logistics.hauls[id];
  if (haul?.phase === 'pickup') abandonHaul(state, id);
  else if (haul) return true;

  const chop = woodcutter[id];
  if (chop?.kind === 'toHut') return true;
  if (chop && chop.kind !== 'idle') woodcutter[id] = { kind: 'idle', retryAt: state.tick };
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

/** Ticks of the night that ended at the Dawn of day `day`. */
function lastNightTicks(day: number, content: Content): number {
  return dawnTick(day, content) - duskTick(day - 1, content);
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
    if (!v) continue;
    if (dusk) v.tired = false;
    if (dawn) {
      v.tired = v.sleptTicks * 100 < lastNightTicks(day, content) * minSleepPercent;
      v.sleptTicks = 0;
      if (v.routine !== 'work') {
        v.routine = 'work';
        stopAtNextTile(state, id); // one still walking home turns back from the next tile
      }
    }
    if (!night) continue;

    switch (v.routine) {
      case 'work': {
        if (!finishWork(state, id)) goHome(state, content, id);
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
    }
  }
}
