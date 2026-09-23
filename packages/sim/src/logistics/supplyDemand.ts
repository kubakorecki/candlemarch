// What can be hauled and where it is needed. Shared by every logistics model.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import type { EntityId, GameState } from '../state';

/** Goods waiting in a building's output buffer. */
export interface Supply {
  building: EntityId;
  resource: ResourceId;
  amount: number;
}

/** Goods a construction site still lacks (not counting anything already on its way). */
export interface Demand {
  site: EntityId;
  resource: ResourceId;
  amount: number;
}

/** Output buffer contents of every building, in building ID order. */
export function listSupplies(state: GameState, content: Content): Supply[] {
  const result: Supply[] = [];
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    const buffer = b ? content.buildings[b.type].outputBuffer : undefined;
    if (!b || !buffer) continue;
    const amount = b.stock[buffer.resource] ?? 0;
    if (amount > 0) result.push({ building: id, resource: buffer.resource, amount });
  }
  return result;
}

/** Missing materials of every construction site: oldest site first, costs in content order. */
export function listDemands(state: GameState, content: Content): Demand[] {
  const result: Demand[] = [];
  for (const id of idsOf(state.components.site)) {
    const site = state.components.site[id];
    const construction = site ? content.buildings[site.type].construction : undefined;
    if (!site || !construction) continue;
    for (const cost of construction.cost) {
      const missing = cost.amount - (site.delivered[cost.resource] ?? 0);
      if (missing > 0) result.push({ site: id, resource: cost.resource, amount: missing });
    }
  }
  return result;
}
