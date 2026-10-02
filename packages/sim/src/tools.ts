// Tools (spec, Economy: Tools: used and sold). A Workplace that makes goods asks for one tool per
// worker and Carriers bring them like an input; it keeps them in `building.tools`, and its workers
// hold them in ID order. A worker holding one works faster; some outputs need one.
import type { BuildingId, Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';
import { workersAt } from './workers';

/** Whether a `type` building uses tools: a Workplace that makes goods (it has outputs). */
export function usesTools(content: Content, type: BuildingId): boolean {
  const def = content.buildings[type];
  return def.employs.length > 0 && def.outputBuffer !== undefined;
}

/** Tools Workplace `building` keeps (each the days it has been worked), or none. */
export function toolsAt(state: GameState, building: EntityId): readonly number[] {
  return state.components.building[building]?.tools ?? [];
}

/**
 * Whether villager `worker` holds a tool at `workplace`: its workers hold its tools in ID order,
 * one each.
 */
export function holdsTool(state: GameState, worker: EntityId, workplace: EntityId): boolean {
  const index = workersAt(state, workplace).indexOf(worker);
  return index >= 0 && index < toolsAt(state, workplace).length;
}

/** `worker`'s work at `workplace` as a percent of normal for its tool: `speedPercent` or 100. */
export function toolSpeedPercent(
  state: GameState,
  content: Content,
  worker: EntityId,
  workplace: EntityId,
): number {
  return holdsTool(state, worker, workplace) ? content.tools.speedPercent : 100;
}

/**
 * Tools each Workplace that uses them still asks for, one per worker less those it keeps (not
 * counting any on their way), in building ID order; Workplaces wanting none are left out.
 */
export function toolsWanted(
  state: GameState,
  content: Content,
): { building: EntityId; amount: number }[] {
  const { building, villager } = state.components;
  const workers: Record<EntityId, number> = {};
  for (const id of idsOf(villager)) {
    const workplace = villager[id]?.workplace ?? null;
    if (workplace !== null) workers[workplace] = (workers[workplace] ?? 0) + 1;
  }
  const wanted: { building: EntityId; amount: number }[] = [];
  for (const id of idsOf(building)) {
    const b = building[id];
    if (!b || !usesTools(content, b.type)) continue;
    const amount = (workers[id] ?? 0) - (b.tools?.length ?? 0);
    if (amount > 0) wanted.push({ building: id, amount });
  }
  return wanted;
}

/** Whether a haul of `resource` to `building` brings it tools (rather than an input or goods). */
export function bringsTools(
  state: GameState,
  content: Content,
  building: EntityId,
  resource: ResourceId,
): boolean {
  const b = state.components.building[building];
  return !!b && resource === content.tools.resource && usesTools(content, b.type);
}

/** Gives Workplace `building` `amount` new tools. */
export function addTools(state: GameState, building: EntityId, amount: number): void {
  const b = state.components.building[building];
  if (!b) return;
  b.tools = [...(b.tools ?? []), ...Array<number>(amount).fill(0)];
}
