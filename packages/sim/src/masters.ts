// Masters (spec, Trades and masters). A Master is an ordinary villager with a trade (the `master`
// store). A trade's workshops (buildings whose content names the trade) wait idle until its first
// Master settles; the Master works in one of them at `masterSpeedPercent`, the rest work at normal
// speed while a Master of the trade lives, and every one crawls at `lostSpeedPercent` once the
// Master is lost. `state.trades` remembers every trade that has had a Master.
import type { BuildingId, Content, TradeId } from '@candlemarch/content';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';

/** Villager `id`'s trade, or null when it isn't a Master. */
export function masterOf(state: GameState, id: EntityId): TradeId | null {
  return state.components.master[id]?.trade ?? null;
}

/**
 * Makes villager `id` a Master of `trade`, and the trade known to the village for good. Staffing
 * puts the Master to work in a workshop of the trade (`systems/staffing.ts`). Masters arrive by
 * Charter (`acceptCharter`); tests call it directly.
 */
export function settleMaster(state: GameState, id: EntityId, trade: TradeId): void {
  if (!state.components.villager[id]) return;
  state.components.master[id] = { trade };
  if (!state.trades.includes(trade)) state.trades.push(trade);
}

/** The trade that runs a `type` workshop, or null when it needs no Master. */
export function tradeOf(content: Content, type: BuildingId): TradeId | null {
  return content.buildings[type].trade ?? null;
}

/** The trade of building `id`, or null when it isn't a workshop needing a Master. */
function buildingTrade(state: GameState, content: Content, id: EntityId): TradeId | null {
  const b = state.components.building[id];
  return b ? tradeOf(content, b.type) : null;
}

/** Whether a Master of `trade` lives in the village. */
export function hasMaster(state: GameState, trade: TradeId): boolean {
  return Object.values(state.components.master).some((m) => m.trade === trade);
}

/**
 * Whether building `id` is a workshop whose trade has never had a Master: it stands idle, takes no
 * inputs and isn't staffed until one settles ("Waiting for a Master").
 */
export function waitingForMaster(state: GameState, content: Content, id: EntityId): boolean {
  const trade = buildingTrade(state, content, id);
  return trade !== null && !state.trades.includes(trade);
}

/**
 * The workshop a Master of `trade` should work in: the first built (lowest ID) whose worker
 * limit leaves a place, or null when there is none.
 */
export function masterWorkshop(
  state: GameState,
  content: Content,
  trade: TradeId,
): EntityId | null {
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    if (b && b.workerLimit > 0 && tradeOf(content, b.type) === trade) return id;
  }
  return null;
}

/**
 * How fast villager `worker` works at `workplace` for its trade, as a percent of normal: the
 * Master in a workshop of their own trade `masterSpeedPercent`, anyone else in a workshop whose
 * trade has lost its Master `lostSpeedPercent`, else 100 (a trade never Mastered doesn't work).
 */
export function tradeSpeedPercent(
  state: GameState,
  content: Content,
  worker: EntityId,
  workplace: EntityId,
): number {
  const trade = buildingTrade(state, content, workplace);
  if (trade === null) return 100;
  if (masterOf(state, worker) === trade) return content.masters.masterSpeedPercent;
  if (!hasMaster(state, trade) && state.trades.includes(trade)) {
    return content.masters.lostSpeedPercent;
  }
  return 100;
}
