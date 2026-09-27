// Foragers: walk to the nearest forage patch in their hut's radius that has stock and shade,
// gather, carry the Food back to the hut's output buffer, repeat. Patches stay when emptied.
import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { canForage } from '../forage';
import { gatherTargets, outputRoom, walkToNearest } from '../gathering';
import { doorTile } from '../grid';
import { workTicks } from '../speed';
import type { GameState } from '../state';
import { isAt, walkTo } from './movement';

export function foragingSystem(state: GameState, content: Content): void {
  const { forager: tasks, villager, building, mapObject, path, tile } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, or off work for the night.
    if (!task || !v || path[id] || v.workplace === null || v.routine !== 'work') continue;
    const hutId = v.workplace;
    const hut = building[hutId];
    const origin = tile[hutId];
    if (!hut || !origin) continue;
    const job = content.jobs[v.job];
    const door = doorTile(content.buildings[hut.type], origin);
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const patches = gatherTargets(state, content, hutId, (p) => canForage(state, content, p));
        const patch = walkToNearest(state, content, id, patches);
        // Nothing in reach, or the buffer is full: wait for a carrier to take something.
        if (patch === null) idle();
        else tasks[id] = { kind: 'toPatch', patch };
        break;
      }
      case 'toPatch': {
        const patch = mapObject[task.patch];
        if (patch && canForage(state, content, task.patch)) {
          // A hero's aura near the hut when the gather starts speeds up the whole gather.
          const gather = content.mapObjects[patch.type].gatherTicks;
          const ticksLeft = workTicks(state, content, id, hutId, gather);
          tasks[id] = { kind: 'gathering', patch: task.patch, ticksLeft };
        } else {
          tasks[id] = { kind: 'idle', retryAt: state.tick }; // emptied or withered meanwhile
        }
        break;
      }
      case 'gathering': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const patch = mapObject[task.patch];
        if (!patch || !canForage(state, content, task.patch)) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const def = content.mapObjects[patch.type];
        const amount = Math.min(def.yieldPerGather, patch.amount, job.carryCapacity);
        patch.amount -= amount;
        v.carrying = { resource: def.resource, amount };
        tasks[id] = { kind: 'toHut' };
        walkTo(state, content, id, [door]);
        break;
      }
      case 'toHut': {
        if (!isAt(state, id, door)) {
          walkTo(state, content, id, [door]); // walk was cut short or blocked; try again
          break;
        }
        const carrying = v.carrying;
        if (carrying) {
          // Wait at the door for room, except after Dusk: then the Food goes in even if it's full.
          if (outputRoom(state, content, hutId, carrying.resource) < carrying.amount && !night) {
            break;
          }
          hut.stock[carrying.resource] = (hut.stock[carrying.resource] ?? 0) + carrying.amount;
          v.carrying = null;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
