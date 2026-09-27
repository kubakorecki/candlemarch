// What can be hauled and where it is needed.
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { foodIds, granaryRoom } from '../granary';
import { stockpileTileIndices } from '../grid';
import type { EntityId, GameState } from '../state';
import { amountOnTile, roomOnTile, STOCKPILE_PRIORITIES, stockpileTakes } from '../stockpiles';
import { isPaused } from '../systems/production';

/** Goods waiting in a building's output buffer or on a stockpile. */
export interface Supply {
  source: EntityId;
  kind: 'building' | 'stockpile';
  resource: ResourceId;
  amount: number;
}

/**
 * Goods a construction site still lacks, or room a workshop's input buffer, a Granary or a
 * stockpile still has (not counting anything already on its way). A Granary's room is shared by
 * every Food: it has one demand per Food, each for all of it.
 */
export interface Demand {
  target: EntityId;
  kind: 'site' | 'workshop' | 'granary' | 'stockpile';
  resource: ResourceId;
  amount: number;
}

/**
 * Units of `resource` workshop `building`'s input buffer still has room for (not counting anything
 * already on its way), or 0 if it has no slot for it, is paused, or isn't a workshop.
 */
export function inputRoom(
  state: GameState,
  content: Content,
  building: EntityId,
  resource: ResourceId,
): number {
  const b = state.components.building[building];
  const slot = b && content.buildings[b.type].inputBuffer?.find((s) => s.resource === resource);
  if (!b || !slot || isPaused(state, content, building)) return 0;
  return Math.max(0, slot.capacity - (b.input[resource] ?? 0));
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
 * Missing materials of every construction site (oldest site first, costs in content order), then
 * room in the input buffer of every workshop that isn't paused (oldest first, buffer slots in
 * content order), then room in every Granary for each Food (oldest first, Foods in content
 * order), then room on every stockpile for each resource it takes (oldest first, resources in
 * content order).
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
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    for (const slot of b ? (content.buildings[b.type].inputBuffer ?? []) : []) {
      const room = inputRoom(state, content, id, slot.resource);
      if (room > 0)
        result.push({ target: id, kind: 'workshop', resource: slot.resource, amount: room });
    }
  }
  for (const id of idsOf(state.components.building)) {
    const room = granaryRoom(state, content, id);
    if (room <= 0) continue;
    for (const resource of foodIds(content)) {
      result.push({ target: id, kind: 'granary', resource, amount: room });
    }
  }
  const capacity = content.logistics.stockpileTileCapacity;
  for (const id of idsOf(state.components.stockpile)) {
    const pile = state.components.stockpile[id];
    if (!pile) continue;
    for (const resource of resourceIds(content)) {
      if (!stockpileTakes(content, pile, resource)) continue;
      let room = 0;
      for (const i of stockpileTileIndices(state, id))
        room += roomOnTile(pile, i, resource, capacity);
      if (room > 0) result.push({ target: id, kind: 'stockpile', resource, amount: room });
    }
  }
  return result;
}

/**
 * Demands in the order they're served: each site on its own, oldest first, then each workshop
 * input buffer on its own, oldest first, then Granaries, those wanting one Food as one group
 * (Foods in content order), then stockpiles, highest priority first, those of one priority wanting
 * one resource (resources in content order) as one group. Within a group, goods go to whichever
 * demand is nearest, ties to the older one.
 */
export function demandGroups(state: GameState, demands: readonly Demand[]): Demand[][] {
  const groups: Demand[][] = [
    ...demands.filter((d) => d.kind === 'site').map((d) => [d]),
    ...demands.filter((d) => d.kind === 'workshop').map((d) => [d]),
  ];
  const granaries = demands.filter((d) => d.kind === 'granary');
  for (const resource of new Set(granaries.map((d) => d.resource))) {
    groups.push(granaries.filter((d) => d.resource === resource));
  }
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
