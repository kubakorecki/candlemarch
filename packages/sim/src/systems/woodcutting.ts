// Woodcutters: walk to the nearest tree outside a Reserve, chop, carry the logs to their hut's
// output buffer, repeat.

import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { gatherTargets, outputRoom, walkToNearest } from '../gathering';
import { doorTile } from '../grid';
import { fellTree } from '../huntingGrounds';
import { inReserve } from '../reserves';
import { staticChanged } from '../snapshot';
import { workTicks } from '../speed';
import type { EntityId, GameState } from '../state';
import { isAtWork } from '../villagers';
import { isAt, walkTo } from './movement';

export function woodcuttingSystem(state: GameState, content: Content): void {
  const { woodcutter: tasks, villager, building, mapObject, path } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, or off work for the night.
    if (!task || !v || path[id] || !isAtWork(v)) continue;

    const job = content.jobs[v.job];
    const hutId = v.workplace;
    if (hutId === null) continue;
    const hut = building[hutId];
    const hutOrigin = state.components.tile[hutId];
    if (!hut || !hutOrigin) continue;
    const door = doorTile(content.buildings[hut.type], hutOrigin, hut.rotation);
    // A tree with logs left, not in a Reserve (which may be painted while the woodcutter is on its
    // way or chopping).
    const fellable = (t: EntityId) => {
      const at = state.components.tile[t];
      return (mapObject[t]?.amount ?? 0) > 0 && at !== undefined && !inReserve(state, at);
    };
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const trees = gatherTargets(state, content, hutId, fellable);
        const tree = walkToNearest(state, content, id, trees);
        // No tree left, or the buffer is full: wait for a carrier to take something.
        if (tree === null) idle();
        else tasks[id] = { kind: 'toTree', tree };
        break;
      }
      case 'toTree': {
        const tree = mapObject[task.tree];
        if (tree && fellable(task.tree)) {
          // A hero's aura near the hut when the chop starts speeds up the whole chop.
          const ticks = workTicks(
            state,
            content,
            id,
            hutId,
            content.mapObjects[tree.type].gatherTicks,
          );
          tasks[id] = { kind: 'chopping', tree: task.tree, ticksLeft: ticks };
        } else {
          // Someone else finished it, or it's in a Reserve now.
          tasks[id] = { kind: 'idle', retryAt: state.tick };
        }
        break;
      }
      case 'chopping': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const tree = mapObject[task.tree];
        if (!tree || !fellable(task.tree)) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const def = content.mapObjects[tree.type];
        const amount = Math.min(def.yieldPerGather, tree.amount, job.carryCapacity);
        tree.amount -= amount;
        staticChanged(state);
        v.carrying = { resource: def.resource, amount };
        if (tree.amount === 0) fellTree(state, content, task.tree);
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
          // Wait at the door for room, except after Dusk: then the logs go in even if it's full.
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
