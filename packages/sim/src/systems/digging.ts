// Diggers (the quarry's, clay pit's and mine's workers): walk to the nearest Deposit in their
// Workplace's radius with something left in it, dig, carry what they dug back to the yard, repeat.
// A dug-out Deposit stays on the map.

import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { canDig } from '../deposits';
import { idsOf } from '../entities';
import { gatherTargets, walkToNearest } from '../gathering';
import { doorTile } from '../grid';
import { staticChanged } from '../snapshot';
import { workTicks } from '../speed';
import { isPaused } from '../standingOrders';
import type { GameState } from '../state';
import { isAtWork, isHelpingCarry } from '../villagers';
import { outputRoom } from '../yards';
import { isAt, walkTo } from './movement';

export function diggingSystem(state: GameState, content: Content): void {
  const { digger: tasks, villager, building, mapObject, path, tile } = state.components;
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
        const deposits = gatherTargets(state, content, workplaceId, (d) =>
          canDig(state, content, d),
        );
        const deposit = walkToNearest(state, content, id, deposits);
        // Nothing left in reach, or the yard is full: wait for a Carrier to take something.
        if (deposit === null) idle();
        else tasks[id] = { kind: 'toDeposit', deposit };
        break;
      }
      case 'toDeposit': {
        const deposit = mapObject[task.deposit];
        if (deposit && canDig(state, content, task.deposit)) {
          // A hero's aura near the Workplace when the dig starts speeds up the whole dig.
          const dig = content.mapObjects[deposit.type].gatherTicks;
          const ticksLeft = workTicks(state, content, id, workplaceId, dig);
          tasks[id] = { kind: 'digging', deposit: task.deposit, ticksLeft };
        } else {
          tasks[id] = { kind: 'idle', retryAt: state.tick }; // dug out by another meanwhile
        }
        break;
      }
      case 'digging': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const deposit = mapObject[task.deposit];
        if (!deposit || !canDig(state, content, task.deposit)) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const def = content.mapObjects[deposit.type];
        const amount = Math.min(def.yieldPerGather, deposit.amount, job.carryCapacity);
        deposit.amount -= amount;
        staticChanged(state);
        v.carrying = { resource: def.resource, amount };
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
