// Diggers (the quarry's, clay pit's, mine's and bog-iron digger's workers): walk to the nearest
// Deposit in their Workplace's radius with something left in it (standing beside it), or for a
// bog-iron digger the nearest Swamp tile with ore (standing on it), dig, carry what they dug back
// to the yard, repeat. A dug-out Deposit stays on the map.

import type { Content, ResourceId } from '@candlemarch/content';
import { digOre, oreAt, oreTargets } from '../bogIron';
import { isNight } from '../calendar';
import { canDig } from '../deposits';
import { idsOf } from '../entities';
import { gatherTargets, walkToNearest } from '../gathering';
import { doorTile, terrainAt, tileAt } from '../grid';
import { staticChanged } from '../snapshot';
import { workTicks } from '../speed';
import { isPaused } from '../standingOrders';
import type { DigSpot, EntityId, GameState, Tile } from '../state';
import { isAtWork, isHelpingCarry } from '../villagers';
import { outputRoom } from '../yards';
import { isAt, villagerTile, walkTo } from './movement';

/** What digging `spot` gives: its resource, work ticks, units a dig and units left. */
interface DigYield {
  resource: ResourceId;
  ticks: number;
  perDig: number;
  left: number;
}

function digYield(state: GameState, content: Content, spot: DigSpot): DigYield | null {
  if ('deposit' in spot) {
    const obj = state.components.mapObject[spot.deposit];
    if (!obj || !canDig(state, content, spot.deposit)) return null;
    const def = content.mapObjects[obj.type];
    return {
      resource: def.resource,
      ticks: def.gatherTicks,
      perDig: def.yieldPerGather,
      left: obj.amount,
    };
  }
  const terrain = terrainAt(state.map, spot.tile);
  const ore = terrain ? content.terrain[terrain].ore : undefined;
  const left = oreAt(state, content, spot.tile);
  if (!ore || left === 0) return null;
  return { resource: ore.resource, ticks: ore.digTicks, perDig: ore.yieldPerDig, left };
}

/**
 * Starts digger `id` walking to the nearest place its Workplace digs: a bog-iron tile, or a
 * Deposit, with yard room for a whole dig. Returns the spot, or null with nothing in reach.
 */
function walkToSpot(
  state: GameState,
  content: Content,
  id: EntityId,
  workplace: EntityId,
): DigSpot | null {
  const type = state.components.building[workplace]?.type;
  const terrain = type ? content.buildings[type].digsOre : undefined;
  const ore = terrain ? content.terrain[terrain].ore : undefined;
  if (ore) {
    if (outputRoom(state, content, workplace, ore.resource) < ore.yieldPerDig) return null;
    const tiles = oreTargets(state, content, workplace);
    if (tiles.length === 0 || !walkTo(state, content, id, tiles)) return null;
    const route = state.components.path[id]?.tiles;
    const end = route?.[route.length - 1];
    const tile: Tile | null = end === undefined ? villagerTile(state, id) : tileAt(state.map, end);
    return tile && { tile };
  }
  const deposits = gatherTargets(state, content, workplace, (d) => canDig(state, content, d));
  const deposit = walkToNearest(state, content, id, deposits);
  return deposit === null ? null : { deposit };
}

/** Takes up to `amount` from `spot`. */
function take(state: GameState, spot: DigSpot, amount: number): void {
  if ('tile' in spot) {
    digOre(state, spot.tile, amount);
    return;
  }
  const obj = state.components.mapObject[spot.deposit];
  if (!obj) return;
  obj.amount -= amount;
  staticChanged(state);
}

export function diggingSystem(state: GameState, content: Content): void {
  const { digger: tasks, villager, building, path, tile } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, off work for the night, or helping carry.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    if (isHelpingCarry(state, id)) continue;
    const workplaceId = v.workplace;
    const workplace = building[workplaceId];
    const origin = tile[workplaceId];
    if (!workplace || !origin) continue;
    const job = content.jobs[v.job];
    const door = doorTile(content.buildings[workplace.type], origin, workplace.rotation);
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        if (isPaused(state, content, workplaceId)) {
          idle(); // paused by its standing order
          break;
        }
        const spot = walkToSpot(state, content, id, workplaceId);
        // Nothing left in reach, or the yard is full: wait for a Carrier to take something.
        if (spot === null) idle();
        else tasks[id] = { kind: 'toDig', spot };
        break;
      }
      case 'toDig': {
        const dig = digYield(state, content, task.spot);
        if (dig) {
          // A hero's aura near the Workplace when the dig starts speeds up the whole dig.
          const ticksLeft = workTicks(state, content, id, workplaceId, dig.ticks);
          tasks[id] = { kind: 'digging', spot: task.spot, ticksLeft };
        } else {
          tasks[id] = { kind: 'idle', retryAt: state.tick }; // dug out by another meanwhile
        }
        break;
      }
      case 'digging': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const dig = digYield(state, content, task.spot);
        if (!dig) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const amount = Math.min(dig.perDig, dig.left, job.carryCapacity);
        take(state, task.spot, amount);
        v.carrying = { resource: dig.resource, amount };
        tasks[id] = { kind: 'toYard' };
        walkTo(state, content, id, [door]);
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
          if (
            outputRoom(state, content, workplaceId, carrying.resource) < carrying.amount &&
            !night
          ) {
            break;
          }
          workplace.stock[carrying.resource] =
            (workplace.stock[carrying.resource] ?? 0) + carrying.amount;
          v.carrying = null;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
