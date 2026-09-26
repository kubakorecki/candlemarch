// What can be hauled and where it is needed. Shared by every logistics model.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { stockpileTileIndices } from '../grid';
import type { EntityId, GameState } from '../state';
import { amountOnTile, roomOnTile, STOCKPILE_PRIORITIES } from '../stockpiles';

/** Goods waiting in a building's output buffer or on a stockpile. */
export interface Supply {
  source: EntityId;
  kind: 'building' | 'stockpile';
  resource: ResourceId;
  amount: number;
}

/**
 * Goods a construction site still lacks, or room a stockpile still has (not counting anything
 * already on its way).
 */
export interface Demand {
  target: EntityId;
  kind: 'site' | 'stockpile';
  resource: ResourceId;
  amount: number;
}

/** Resource IDs in content order. */
function resourceIds(content: Content): ResourceId[] {
  return Object.keys(content.resources) as ResourceId[];
}

/**
 * Output buffer contents of every building in building ID order, then the goods on every
 * stockpile in stockpile ID order (resources in content order).
 */
export function listSupplies(state: GameState, content: Content): Supply[] {
  const result: Supply[] = [];
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    const buffer = b ? content.buildings[b.type].outputBuffer : undefined;
    if (!b || !buffer) continue;
    const amount = b.stock[buffer.resource] ?? 0;
    if (amount > 0) {
      result.push({ source: id, kind: 'building', resource: buffer.resource, amount });
    }
  }
  for (const id of idsOf(state.components.stockpile)) {
    const pile = state.components.stockpile[id];
    if (!pile) continue;
    for (const resource of resourceIds(content)) {
      let amount = 0;
      for (const i of stockpileTileIndices(state, id)) amount += amountOnTile(pile, i, resource);
      if (amount > 0) result.push({ source: id, kind: 'stockpile', resource, amount });
    }
  }
  return result;
}

/**
 * Missing materials of every construction site (oldest site first, costs in content order),
 * then room on every stockpile that doesn't refuse the resource (oldest first, resources in
 * content order). Sites always come before stockpiles.
 */
export function listDemands(state: GameState, content: Content): Demand[] {
  const result: Demand[] = [];
  for (const id of idsOf(state.components.site)) {
    const site = state.components.site[id];
    const construction = site ? content.buildings[site.type].construction : undefined;
    if (!site || !construction) continue;
    for (const cost of construction.cost) {
      const missing = cost.amount - (site.delivered[cost.resource] ?? 0);
      if (missing > 0) {
        result.push({ target: id, kind: 'site', resource: cost.resource, amount: missing });
      }
    }
  }
  const capacity = content.logistics.stockpileTileCapacity;
  for (const id of idsOf(state.components.stockpile)) {
    const pile = state.components.stockpile[id];
    if (!pile) continue;
    for (const resource of resourceIds(content)) {
      if (pile.refuses.includes(resource)) continue;
      let room = 0;
      for (const i of stockpileTileIndices(state, id))
        room += roomOnTile(pile, i, resource, capacity);
      if (room > 0) result.push({ target: id, kind: 'stockpile', resource, amount: room });
    }
  }
  return result;
}

/**
 * Demands in the order they're served: each site on its own, oldest first, then stockpiles,
 * highest priority first, those of one priority wanting one resource (resources in content
 * order) as one group. Within a group, goods go to whichever demand is nearest, ties to the
 * older one.
 */
export function demandGroups(state: GameState, demands: readonly Demand[]): Demand[][] {
  const groups: Demand[][] = demands.filter((d) => d.kind === 'site').map((d) => [d]);
  const piles = demands.filter((d) => d.kind === 'stockpile');
  const resources = [...new Set(piles.map((d) => d.resource))];
  for (const priority of STOCKPILE_PRIORITIES) {
    for (const resource of resources) {
      const group = piles.filter(
        (d) =>
          d.resource === resource && state.components.stockpile[d.target]?.priority === priority,
      );
      if (group.length > 0) groups.push(group);
    }
  }
  return groups;
}

/** Whether goods from `supply` may be hauled to `demand`. A stockpile never supplies another. */
export function canServe(supply: Supply, demand: Demand): boolean {
  if (supply.resource !== demand.resource) return false;
  return !(supply.kind === 'stockpile' && demand.kind === 'stockpile');
}
