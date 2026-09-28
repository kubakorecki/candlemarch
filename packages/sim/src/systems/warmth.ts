// Warmth. At each Dusk of a cold season (winter) every House with residents burns fuel from its
// buffer; one that can't, or has nobody living in it, is cold until Dawn. At each Dawn every
// villager counts the night: a cold season's night not spent asleep at a warm Home (in a cold
// House, or in the open) is a cold night; any other night resets the count. A Watchman in its
// watchtower at Dawn is sheltered there: not a cold night. The second cold night in a row freezes
// the villager to death. The hero isn't a villager and never gets cold.
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn, isDusk } from '../calendar';
import { killVillager } from '../deaths';
import { idsOf } from '../entities';
import { isAtHome, residentsOf } from '../homes';
import type { EntityId, GameState } from '../state';
import { fuelIn, isColdSeason, isHouse } from '../warmth';
import { isOnWatch } from '../watchtowers';

/** Whether villager `id` is asleep at its Home and that House is warm tonight. */
function isAsleepInWarmHome(state: GameState, content: Content, id: EntityId): boolean {
  const v = state.components.villager[id];
  if (!v || v.home === null || v.routine !== 'asleep' || !isAtHome(state, content, id)) {
    return false;
  }
  return state.components.building[v.home]?.cold === false;
}

export function warmthSystem(state: GameState, content: Content): void {
  const { villager, building } = state.components;
  // The game starts at Dawn on day 1, after no night.
  if (isDawn(state.tick, content) && calendarAt(state.tick, content).day > 1) {
    const coldNight = isColdSeason(state.tick - 1, content);
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (!v) continue;
      const warm =
        !coldNight || isAsleepInWarmHome(state, content, id) || isOnWatch(state, content, id);
      v.coldNights = warm ? 0 : v.coldNights + 1;
      if (v.coldNights >= content.needs.cold.freezeAfterColdNights) {
        killVillager(state, content, id, 'freezing');
      }
    }
    for (const id of idsOf(building)) {
      const b = building[id];
      if (b) b.cold = false;
    }
  }

  if (isDusk(state.tick, content) && isColdSeason(state.tick, content)) {
    const { fuel, burnPerNight } = content.needs.cold;
    for (const id of idsOf(building)) {
      const b = building[id];
      if (!b || !isHouse(state, content, id)) continue;
      const lit = residentsOf(state, id).length > 0 && fuelIn(state, content, id) >= burnPerNight;
      if (lit) b.stock[fuel] = fuelIn(state, content, id) - burnPerNight;
      b.cold = !lit;
    }
  }
}
