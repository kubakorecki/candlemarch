// Workshops: a crafter at the door takes a recipe's inputs from the input buffer, works, and puts
// its outputs in the output buffer. It waits while inputs are missing or the outputs won't fit.
import type { Content, RecipeId, ResourceId } from '@candlemarch/content';
import { workTicks } from '../aura';
import { idsOf } from '../entities';
import { doorTile } from '../grid';
import type { EntityId, GameState } from '../state';
import { isAt, walkTo } from './movement';

/** Units of `resource` the village holds: on Stockpiles. */
export function villageStock(state: GameState, resource: ResourceId): number {
  let total = 0;
  for (const pile of Object.values(state.components.stockpile)) {
    for (const goods of Object.values(pile.goods)) {
      if (goods.resource === resource) total += goods.amount;
    }
  }
  return total;
}

/**
 * Whether workshop `building` is paused because the village holds its stock target: it starts no
 * new work and its input buffer asks for nothing. Work already started still finishes.
 */
export function isPaused(state: GameState, content: Content, building: EntityId): boolean {
  const b = state.components.building[building];
  const target = b ? content.buildings[b.type].stockTarget : undefined;
  return target !== undefined && villageStock(state, target.resource) >= target.amount;
}

/** Units of `resource` that crafters working at `building` will put in its output buffer. */
function outputInProgress(
  state: GameState,
  content: Content,
  building: EntityId,
  resource: ResourceId,
): number {
  const { crafter, villager } = state.components;
  let total = 0;
  for (const id of idsOf(crafter)) {
    const task = crafter[id];
    if (task?.kind !== 'working' || villager[id]?.workplace !== building) continue;
    for (const out of content.recipes[task.recipe].outputs) {
      if (out.resource === resource) total += out.amount;
    }
  }
  return total;
}

/**
 * The first of the workshop's recipes that can start now: it isn't paused, every input is in the
 * input buffer, and every output fits in the output buffer alongside work already under way.
 * Null if none can.
 */
function startableRecipe(state: GameState, content: Content, building: EntityId): RecipeId | null {
  const b = state.components.building[building];
  if (!b || isPaused(state, content, building)) return null;
  const def = content.buildings[b.type];
  const capacity = def.outputBuffer?.capacity ?? 0;
  for (const id of def.recipes ?? []) {
    const recipe = content.recipes[id];
    const hasInputs = recipe.inputs.every((i) => (b.input[i.resource] ?? 0) >= i.amount);
    const outputsFit = recipe.outputs.every(
      (o) =>
        (b.stock[o.resource] ?? 0) +
          outputInProgress(state, content, building, o.resource) +
          o.amount <=
        capacity,
    );
    if (hasInputs && outputsFit) return id;
  }
  return null;
}

export function productionSystem(state: GameState, content: Content): void {
  const { crafter: tasks, villager, building, tile, path } = state.components;
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    if (!task || !v || path[id] || v.workplace === null) continue; // still walking
    const workshopId = v.workplace;
    const workshop = building[workshopId];
    const origin = tile[workshopId];
    if (!workshop || !origin) continue;
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + content.jobs[v.job].idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const door = doorTile(content.buildings[workshop.type], origin);
        if (!isAt(state, id, door)) {
          if (!walkTo(state, content, id, [door])) idle();
          break;
        }
        const recipeId = startableRecipe(state, content, workshopId);
        if (recipeId === null) {
          idle(); // missing inputs, output full, or paused
          break;
        }
        const recipe = content.recipes[recipeId];
        for (const i of recipe.inputs) {
          workshop.input[i.resource] = (workshop.input[i.resource] ?? 0) - i.amount;
        }
        // A hero's aura near the workshop when the work starts speeds up the whole batch.
        const ticksLeft = workTicks(state, content, workshopId, recipe.workTicks);
        tasks[id] = { kind: 'working', recipe: recipeId, ticksLeft };
        break;
      }
      case 'working': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        for (const o of content.recipes[task.recipe].outputs) {
          workshop.stock[o.resource] = (workshop.stock[o.resource] ?? 0) + o.amount;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
