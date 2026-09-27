// Warmth: each House keeps a buffer of fuel (firewood) in its `stock`, asks for it from the start
// of autumn to the end of winter, and burns it on winter nights (`systems/warmth.ts`).
import type { Content, SeasonId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { housePlaces, residentsOf } from './homes';
import type { EntityId, GameState } from './state';

/** Whether `building` is a House. */
export function isHouse(state: GameState, content: Content, building: EntityId): boolean {
  return housePlaces(state, content, building) > 0;
}

/** Season at `tick`. */
function seasonAt(tick: number, content: Content): SeasonId {
  return calendarAt(tick, content).season;
}

/** Whether Houses ask for fuel at `tick`: from the start of autumn to the end of winter. */
export function isStockingUp(tick: number, content: Content): boolean {
  return content.needs.cold.stockUpSeasons.includes(seasonAt(tick, content));
}

/** Whether the night that starts at `tick`'s Dusk (or is under way at `tick`) is a cold one. */
export function isColdSeason(tick: number, content: Content): boolean {
  return content.needs.cold.coldSeasons.includes(seasonAt(tick, content));
}

/** Units of fuel House `house` holds; 0 for anything that isn't a House. */
export function fuelIn(state: GameState, content: Content, house: EntityId): number {
  if (!isHouse(state, content, house)) return 0;
  return state.components.building[house]?.stock[content.needs.cold.fuel] ?? 0;
}

/**
 * Units of fuel House `house` still asks for (not counting anything on its way): room in its
 * buffer while Houses stock up, otherwise 0. 0 for anything that isn't a House.
 */
export function houseFuelRoom(state: GameState, content: Content, house: EntityId): number {
  if (!isHouse(state, content, house) || !isStockingUp(state.tick, content)) return 0;
  return Math.max(0, content.needs.cold.houseBuffer - fuelIn(state, content, house));
}

/**
 * Whether House `house` is cold: tonight, when it couldn't burn fuel at Dusk; on a day in a cold
 * season, when it has residents and not enough fuel for tonight. Empty Houses aren't shown cold.
 */
export function isColdHouse(state: GameState, content: Content, house: EntityId): boolean {
  const b = state.components.building[house];
  if (!b || !isHouse(state, content, house) || residentsOf(state, house).length === 0) return false;
  if (calendarAt(state.tick, content).isNight) return b.cold;
  return (
    isColdSeason(state.tick, content) &&
    fuelIn(state, content, house) < content.needs.cold.burnPerNight
  );
}
