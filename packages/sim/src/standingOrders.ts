// Standing orders (spec, Logistics: Where goods are kept): each Workplace with outputs keeps one
// number N, `building.standingOrder`. It pauses while the village holds at least N of its output
// (its first, `outputBuffer.resources[0]`), and resumes below N. A new one starts at that output's
// default (`ResourceDef.standingOrder`). Paused, it starts no new work and asks for no inputs, and
// its workers help carry (`logistics/helping.ts`).
import type { BuildingId, Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import { lightDef, lightFuelIn } from './lights';
import type { EntityId, GameState } from './state';
import { storageOf } from './storage';
import { fuelIn } from './warmth';

/** The most a standing order may be set to. */
export const MAX_STANDING_ORDER = 999;

/** The output a `type` building's standing order counts: its first, or null without outputs. */
export function standingOrderResource(content: Content, type: BuildingId): ResourceId | null {
  return content.buildings[type].outputBuffer?.resources[0] ?? null;
}

/** The standing order a new `type` building starts with, or null for one without outputs. */
export function defaultStandingOrder(content: Content, type: BuildingId): number | null {
  const resource = standingOrderResource(content, type);
  return resource === null ? null : (content.resources[resource].standingOrder ?? null);
}

/**
 * Units of `resource` the village holds: on Stockpiles, in Workplace yards, in Storage (but not
 * the trade post's goods for sale), and for fuel in Houses and lights too. Goods being carried, on
 * sites or in workshop inputs don't count.
 */
export function villageStock(state: GameState, content: Content, resource: ResourceId): number {
  let total = 0;
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    if (!b) continue;
    if (content.buildings[b.type].outputBuffer?.resources.includes(resource)) {
      total += b.stock[resource] ?? 0;
    }
    // Goods for sale at the trade post are on their way out.
    if (!content.buildings[b.type].tradePost) {
      total +=
        storageOf(state, content, id)?.goods.find((g) => g.resource === resource)?.amount ?? 0;
    }
    if (resource === content.needs.cold.fuel) total += fuelIn(state, content, id);
    if (lightDef(state, content, id)?.fuel === resource) total += lightFuelIn(state, content, id);
  }
  for (const pile of Object.values(state.components.stockpile)) {
    for (const goods of Object.values(pile.goods)) {
      if (goods.resource === resource) total += goods.amount;
    }
  }
  return total;
}

/**
 * Whether Workplace `building` is paused by its standing order: the village holds at least that
 * many of its output. Work already started still finishes.
 */
export function isPaused(state: GameState, content: Content, building: EntityId): boolean {
  const b = state.components.building[building];
  if (!b || b.standingOrder === null) return false;
  const resource = standingOrderResource(content, b.type);
  return resource !== null && villageStock(state, content, resource) >= b.standingOrder;
}

/** What the panel shows of a Workplace's standing order, or null for a building without one. */
export interface StandingOrder {
  resource: ResourceId;
  amount: number;
  /** What the village holds of it now (`villageStock`). */
  held: number;
  paused: boolean;
}

export function standingOrderOf(
  state: GameState,
  content: Content,
  building: EntityId,
): StandingOrder | null {
  const b = state.components.building[building];
  const resource = b ? standingOrderResource(content, b.type) : null;
  if (!b || b.standingOrder === null || resource === null) return null;
  const held = villageStock(state, content, resource);
  return { resource, amount: b.standingOrder, held, paused: held >= b.standingOrder };
}

/**
 * Sets Workplace `building`'s standing order (the `setStandingOrder` command). Ignored unless it
 * has outputs and `amount` is a whole number from 0 to `MAX_STANDING_ORDER`.
 */
export function setStandingOrder(
  state: GameState,
  content: Content,
  building: EntityId,
  amount: number,
): void {
  const b = state.components.building[building];
  if (!b || standingOrderResource(content, b.type) === null) return;
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_STANDING_ORDER) return;
  b.standingOrder = amount;
}
