// Workshops: a crafter at the door takes a recipe's inputs from the input buffer, works, and puts
// its outputs in the output buffer. It waits while inputs are missing or the outputs won't fit.

import type { Content, RecipeId, ResourceAmount, ResourceId } from '@candlemarch/content';
import { idsOf } from '../entities';
import { doorTile } from '../grid';
import { lightDef, lightFuelIn } from '../lights';
import { workTicks } from '../speed';
import type { EntityId, GameState } from '../state';
import { isAtWork, isHelpingCarry } from '../villagers';
import { fuelIn } from '../warmth';
import { fitsInYard } from '../yards';
import { isAt, walkTo } from './movement';

/**
 * Units of `resource` the village holds: on Stockpiles, and for fuel in Houses and lights too.
 */
export function villageStock(state: GameState, content: Content, resource: ResourceId): number {
  let total = 0;
  for (const id of idsOf(state.components.building)) {
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
 * Whether workshop `building` is paused because the village holds its stock target: it starts no
 * new work and its input buffer asks for nothing. Work already started still finishes.
 */
export function isPaused(state: GameState, content: Content, building: EntityId): boolean {
  const b = state.components.building[building];
  const target = b ? content.buildings[b.type].stockTarget : undefined;
  return target !== undefined && villageStock(state, content, target.resource) >= target.amount;
}

/** What crafters working at `building` will put in its yard once their batches finish. */
function outputsInProgress(
  state: GameState,
  content: Content,
  building: EntityId,
): ResourceAmount[] {
  const { crafter, villager } = state.components;
  const result: ResourceAmount[] = [];
  for (const id of idsOf(crafter)) {
    const task = crafter[id];
    if (task?.kind !== 'working' || villager[id]?.workplace !== building) continue;
    result.push(...content.recipes[task.recipe].outputs);
  }
  return result;
}

/**
 * What stops `recipe` starting at workshop `building` now: inputs it lacks, and every output when
 * the batch wouldn't fit whole in the yard alongside what's there and work already under way.
 */
export function recipeBlockers(
  state: GameState,
  content: Content,
  building: EntityId,
  recipe: RecipeId,
): { missing: ResourceId[]; noRoom: ResourceId[] } {
  const b = state.components.building[building];
  if (!b) return { missing: [], noRoom: [] };
  const { inputs, outputs } = content.recipes[recipe];
  const all = [...outputsInProgress(state, content, building), ...outputs];
  return {
    missing: inputs.filter((i) => (b.input[i.resource] ?? 0) < i.amount).map((i) => i.resource),
    noRoom: fitsInYard(state, content, building, all) ? [] : outputs.map((o) => o.resource),
  };
}

/**
 * The first of the workshop's recipes that can start now: it isn't paused, every input is in the
 * input buffer, and every output fits in the output buffer alongside work already under way.
 * Null if none can.
 */
function startableRecipe(state: GameState, content: Content, building: EntityId): RecipeId | null {
  const b = state.components.building[building];
  if (!b || isPaused(state, content, building)) return null;
  for (const id of content.buildings[b.type].recipes ?? []) {
    const { missing, noRoom } = recipeBlockers(state, content, building, id);
    if (missing.length === 0 && noRoom.length === 0) return id;
  }
  return null;
}

export function productionSystem(state: GameState, content: Content): void {
  const { crafter: tasks, villager, building, tile, path } = state.components;
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, off work for the night, or helping carry.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    if (isHelpingCarry(state, id)) continue;
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
        const recipeId = startableRecipe(state, content, workshopId);
        if (recipeId === null) {
          idle(); // missing inputs, output full, or paused: wait where it stands (helping carry)
          break;
        }
        const door = doorTile(content.buildings[workshop.type], origin, workshop.rotation);
        if (!isAt(state, id, door)) {
          if (!walkTo(state, content, id, [door])) idle();
          break;
        }
        const recipe = content.recipes[recipeId];
        for (const i of recipe.inputs) {
          workshop.input[i.resource] = (workshop.input[i.resource] ?? 0) - i.amount;
        }
        // A hero's aura near the workshop when the work starts speeds up the whole batch.
        const ticksLeft = workTicks(state, content, id, workshopId, recipe.workTicks);
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
