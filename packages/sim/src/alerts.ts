// Alerts: death-spiral warnings worked out from the current state, never stored. The HUD lists
// them and moves the camera to an alert's `target` when it's clicked. Red: a villager dies at the
// next Dusk or Dawn unless something changes. Amber: the village is heading for trouble. Food
// projections ignore Spoilage (the HUD says "about").
import type { Content, SeasonId } from '@candlemarch/content';
import { calendarAt, isNight } from './calendar';
import { idsOf } from './entities';
import { isGranary, villageFood } from './granary';
import { residentsOf } from './homes';
import { groundHealth } from './huntingGrounds';
import type { EntityId, GameState, Tile, VillagerComponent } from './state';
import { villagerTile } from './systems/movement';
import { villageStock } from './systems/production';
import { fuelIn, isColdHouse, isColdSeason, isHouse, isStockingUp } from './warmth';

export type AlertSeverity = 'red' | 'amber';

/** What an alert is about, with the numbers and names its text needs. */
export type AlertData =
  /**
   * Villager `villager` starves at the next Dusk (or, still out at night, Dawn): one Meal short of
   * starving, and the Granaries don't hold a Meal for everyone.
   */
  | { kind: 'willStarve'; villager: EntityId; name: string; at: 'dusk' | 'dawn' }
  /**
   * Villager `villager` freezes at the next Dawn: one cold night short of freezing, on a winter
   * day or night, Homeless or in a House without firewood for tonight.
   */
  | { kind: 'willFreeze'; villager: EntityId; name: string }
  /** The Granaries hold Meals for everyone for about `days` days, under `content.alerts.lowFoodDays`. */
  | { kind: 'lowFood'; days: number }
  /** In autumn: Food for about `days` days can't cover the rest of autumn and winter. */
  | { kind: 'winterFood'; days: number; winterIn: number }
  /** In autumn and winter: `houses` occupied Houses have no firewood at all. */
  | { kind: 'noFirewood'; houses: number }
  /** In autumn: firewood in stock burns for `nights` nights, under the `needed` winter nights. */
  | { kind: 'lowFirewood'; nights: number; needed: number }
  /** `villagers` villagers are Hungry, Cold or Homeless. */
  | { kind: 'hungry' | 'cold' | 'homeless'; villagers: number }
  /** Hunting ground `name` has turned Scarce (or run out of Game). */
  | { kind: 'scarceGround'; name: string; health: 'scarce' | 'empty' };

export type Alert = AlertData & {
  severity: AlertSeverity;
  /** Where the camera goes when the alert is clicked, or null for nowhere in particular. */
  target: Tile | null;
};

function isCold(content: Content, season: SeasonId): boolean {
  return content.needs.cold.coldSeasons.includes(season);
}

/** Index in the calendar of the season after `season`. */
function nextSeasonIndex(content: Content, season: SeasonId): number {
  const { seasons } = content.calendar;
  return (seasons.findIndex((s) => s.id === season) + 1) % seasons.length;
}

/**
 * Days left before winter (the next cold season), counting today, through the season before it
 * (autumn); null in any other season.
 */
export function winterIn(state: GameState, content: Content): number | null {
  const { season, dayOfSeason } = calendarAt(state.tick, content);
  const next = content.calendar.seasons[nextSeasonIndex(content, season)];
  if (isCold(content, season) || !next || !isCold(content, next.id)) return null;
  return content.calendar.daysPerSeason - dayOfSeason + 1;
}

/** Days in the winter that starts after the current season: its cold seasons in a row. */
function winterDays(state: GameState, content: Content): number {
  const { seasons, daysPerSeason } = content.calendar;
  let index = nextSeasonIndex(content, calendarAt(state.tick, content).season);
  let days = 0;
  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[index];
    if (!season || !isCold(content, season.id)) break;
    days += daysPerSeason;
    index = (index + 1) % seasons.length;
  }
  return days;
}

/** Anchor tile of entity `id`, or null. */
function tileOf(state: GameState, id: EntityId | undefined): Tile | null {
  if (id === undefined) return null;
  const tile = state.components.tile[id];
  return tile ? { x: tile.x, y: tile.y } : null;
}

/** The first Granary's tile, where Food alerts point. */
function granaryTarget(state: GameState, content: Content): Tile | null {
  const granary = idsOf(state.components.building).find((id) => isGranary(state, content, id));
  return tileOf(state, granary);
}

/** Houses somebody lives in, in ID order. */
function occupiedHouses(state: GameState, content: Content): EntityId[] {
  return idsOf(state.components.building).filter(
    (id) => isHouse(state, content, id) && residentsOf(state, id).length > 0,
  );
}

/** The firewood alerts: empty buffers in autumn and winter, too little stock in autumn. */
function firewoodAlerts(state: GameState, content: Content): Alert[] {
  const list: Alert[] = [];
  const houses = occupiedHouses(state, content);
  if (houses.length === 0) return list;
  if (isStockingUp(state.tick, content)) {
    const empty = houses.filter((id) => fuelIn(state, content, id) === 0);
    if (empty.length > 0) {
      list.push({
        kind: 'noFirewood',
        houses: empty.length,
        severity: 'amber',
        target: tileOf(state, empty[0]),
      });
    }
  }
  if (winterIn(state, content) !== null) {
    const { fuel, burnPerNight } = content.needs.cold;
    const nightly = houses.length * burnPerNight;
    const needed = winterDays(state, content);
    const stock = villageStock(state, content, fuel);
    if (stock < nightly * needed) {
      list.push({
        kind: 'lowFirewood',
        nights: Math.floor(stock / nightly),
        needed,
        severity: 'amber',
        target: tileOf(state, houses[0]),
      });
    }
  }
  return list;
}

/** A red alert for each villager who dies at the next Dusk or Dawn unless something changes. */
function deathAlerts(state: GameState, content: Content): Alert[] {
  const { villager } = state.components;
  const { starveAfterMissedMeals, mealUnits } = content.needs.hungry;
  const ids = idsOf(villager);
  const mealsShort = villageFood(state, content) < ids.length * mealUnits;
  const coldTonight = isColdSeason(state.tick, content);
  const night = isNight(state.tick, content);
  const list: Alert[] = [];
  for (const id of ids) {
    const v = villager[id];
    if (!v) continue;
    const target = villagerTile(state, id);
    if (mealsShort && v.missedMeals + 1 >= starveAfterMissedMeals) {
      // Still at work or on the way to a Granary at night: the Meal is missed at Dawn.
      const out = night && (v.routine === 'work' || v.routine === 'toGranary');
      const at = out ? 'dawn' : 'dusk';
      list.push({ kind: 'willStarve', villager: id, name: v.name, at, severity: 'red', target });
    }
    const unheated = v.home === null || isColdHouse(state, content, v.home);
    if (coldTonight && unheated && v.coldNights + 1 >= content.needs.cold.freezeAfterColdNights) {
      list.push({ kind: 'willFreeze', villager: id, name: v.name, severity: 'red', target });
    }
  }
  return list;
}

/** One alert each for Hungry, Cold and Homeless villagers, pointing at the first of them. */
function villagerAlerts(state: GameState): Alert[] {
  const needs = {
    hungry: (v: VillagerComponent) => v.missedMeals > 0,
    cold: (v: VillagerComponent) => v.coldNights > 0,
    homeless: (v: VillagerComponent) => v.home === null,
  };
  const list: Alert[] = [];
  for (const kind of ['hungry', 'cold', 'homeless'] as const) {
    const ids = idsOf(state.components.villager).filter((id) => {
      const v = state.components.villager[id];
      return v !== undefined && needs[kind](v);
    });
    const first = ids[0];
    if (first === undefined) continue;
    list.push({
      kind,
      villagers: ids.length,
      severity: 'amber',
      target: villagerTile(state, first),
    });
  }
  return list;
}

/** One alert for each Hunting ground turned Scarce or empty, pointing at its middle. */
function groundAlerts(state: GameState, content: Content): Alert[] {
  const list: Alert[] = [];
  for (const id of idsOf(state.components.huntingGround)) {
    const ground = state.components.huntingGround[id];
    if (!ground) continue;
    const health = groundHealth(ground, content);
    if (health !== 'scarce' && health !== 'empty') continue;
    list.push({
      kind: 'scarceGround',
      name: ground.name,
      health,
      severity: 'amber',
      target: { x: ground.x + Math.floor(ground.w / 2), y: ground.y + Math.floor(ground.h / 2) },
    });
  }
  return list;
}

/** The Food alerts: under a few days of Meals, and in autumn too little to last the winter. */
function foodAlerts(state: GameState, content: Content): Alert[] {
  const list: Alert[] = [];
  const dailyFood = idsOf(state.components.villager).length * content.needs.hungry.mealUnits;
  if (dailyFood === 0) return list;
  const food = villageFood(state, content);
  const days = Math.floor(food / dailyFood);
  const target = granaryTarget(state, content);
  if (food < dailyFood * content.alerts.lowFoodDays) {
    list.push({ kind: 'lowFood', days, severity: 'amber', target });
  }
  const winter = winterIn(state, content);
  if (winter !== null && food < dailyFood * (winter + winterDays(state, content))) {
    list.push({ kind: 'winterFood', days, winterIn: winter, severity: 'amber', target });
  }
  return list;
}

/** Every alert that holds now: red ones first (in villager ID order), then amber. */
export function alerts(state: GameState, content: Content): Alert[] {
  return [
    ...deathAlerts(state, content),
    ...foodAlerts(state, content),
    ...firewoodAlerts(state, content),
    ...villagerAlerts(state),
    ...groundAlerts(state, content),
  ];
}
