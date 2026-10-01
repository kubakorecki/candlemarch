// Farmers (spec, Resources: Farms and crops): walk onto the nearest Field in their farm's radius
// with work they can do (`farmWork`: clear a Fieldstone, sow, harvest) that no other farmer is
// going to, do it, and carry what it gives (a harvest, a Fieldstone) back to the yard. With
// nothing to do (growing season, winter, a full yard) they wait and look again.
import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { farmCrop, farmWork, fieldAt, fieldWork, workGives } from '../fields';
import { doorTile, tileAt, tileIndex } from '../grid';
import { staticChanged } from '../snapshot';
import { workTicks } from '../speed';
import type { EntityId, FieldWork, GameState, Tile } from '../state';
import { isAtWork, isHelpingCarry } from '../villagers';
import { fitsInYard, outputRoom } from '../yards';
import { isAt, villagerTile, walkTo } from './movement';

export function farmingSystem(state: GameState, content: Content): void {
  const { farmer: tasks, villager, building, path, tile } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, off work for the night, or helping carry.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    if (isHelpingCarry(state, id)) continue;
    const farmId = v.workplace;
    const farm = building[farmId];
    const origin = tile[farmId];
    if (!farm || !origin) continue;
    const job = content.jobs[v.job];
    const door = doorTile(content.buildings[farm.type], origin, farm.rotation);

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const field = walkToField(state, content, id, farmId);
        if (field === null) tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
        else tasks[id] = { kind: 'toField', field };
        break;
      }
      case 'toField': {
        const work = isAt(state, id, task.field)
          ? doableWork(state, content, farmId, task.field)
          : null;
        if (work === null) {
          // The walk was cut short, or the work was done or went meanwhile.
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        // A hero's aura near the farm when the work starts speeds up the whole of it.
        const ticksLeft = workTicks(state, content, id, farmId, ticksFor(content, work));
        tasks[id] = { kind: 'working', field: task.field, work, ticksLeft };
        break;
      }
      case 'working': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const field = fieldAt(state, task.field);
        if (!field || doableWork(state, content, farmId, task.field) !== task.work) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const gives = workGives(content, field, task.work);
        if (task.work === 'clear') {
          field.stone = false;
        } else if (task.work === 'sow') {
          const crop = farmCrop(state, content, farmId);
          field.stage = 'sown';
          field.crop = crop;
          field.ripensAt = state.tick + content.crops[crop].growDays * content.calendar.dayTicks;
        } else {
          field.stage = 'stubble';
          field.crop = null;
        }
        staticChanged(state);
        if (gives) {
          v.carrying = { ...gives };
          tasks[id] = { kind: 'toYard' };
          walkTo(state, content, id, [door]);
        } else {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
        }
        break;
      }
      case 'toYard': {
        if (!isAt(state, id, door)) {
          walkTo(state, content, id, [door]); // walk was cut short or blocked; try again
          break;
        }
        const carrying = v.carrying;
        if (carrying) {
          // Wait at the door for room, except after Dusk: then it goes on the yard even if full.
          if (outputRoom(state, content, farmId, carrying.resource) < carrying.amount && !night) {
            break;
          }
          farm.stock[carrying.resource] = (farm.stock[carrying.resource] ?? 0) + carrying.amount;
          v.carrying = null;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}

function ticksFor(content: Content, work: FieldWork): number {
  const { farming } = content;
  if (work === 'clear') return farming.clearTicks;
  return work === 'sow' ? farming.sowTicks : farming.harvestTicks;
}

/** The work on `field` farm `farmId`'s farmers can do now, with yard room for what it gives. */
function doableWork(
  state: GameState,
  content: Content,
  farmId: EntityId,
  field: Tile,
): FieldWork | null {
  const work = fieldWork(state, content, farmId, field);
  const at = fieldAt(state, field);
  if (work === null || !at) return null;
  const gives = workGives(content, at, work);
  return gives === null || fitsInYard(state, content, farmId, [gives]) ? work : null;
}

/**
 * Starts farmer `id` walking to the nearest Field (by walking) with work it can do (`farmWork`)
 * that no other farmer is going to or working. Returns that Field, or null.
 */
function walkToField(
  state: GameState,
  content: Content,
  id: EntityId,
  farmId: EntityId,
): Tile | null {
  const { map } = state;
  const taken = new Set<number>();
  for (const other of idsOf(state.components.farmer)) {
    const task = state.components.farmer[other];
    if (other === id || !task || (task.kind !== 'toField' && task.kind !== 'working')) continue;
    taken.add(tileIndex(map, task.field.x, task.field.y));
  }
  const fields = farmWork(state, content, farmId)
    .map((job) => job.field)
    .filter((t) => !taken.has(tileIndex(map, t.x, t.y)));
  if (fields.length === 0 || !walkTo(state, content, id, fields)) return null;
  const route = state.components.path[id]?.tiles;
  const end = route?.[route.length - 1];
  return end === undefined ? villagerTile(state, id) : tileAt(map, end);
}
