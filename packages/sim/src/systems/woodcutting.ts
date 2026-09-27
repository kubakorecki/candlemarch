// Woodcutters: walk to the nearest tree, chop, carry the logs to their hut's output buffer, repeat.
import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { destroyEntity, idsOf } from '../entities';
import { blockedGrid, doorTile, standingTiles, tileIndex } from '../grid';
import { tileDistance } from '../pathfinding';
import { workTicks } from '../speed';
import type { EntityId, GameState, Tile } from '../state';
import { isAt, villagerTile, walkTo } from './movement';

/** Starts a walk to the nearest reachable tree with something left. Returns its ID, or null. */
function walkToNearestTree(state: GameState, content: Content, id: EntityId): EntityId | null {
  const workplace = state.components.villager[id]?.workplace;
  const hut = workplace != null ? state.components.building[workplace] : undefined;
  const here = villagerTile(state, id);
  const gathers = hut ? content.buildings[hut.type].gathers : undefined;
  if (!here || gathers === undefined) return null;

  const { map } = state;
  const { mapObject, tile } = state.components;
  const hereIndex = tileIndex(map, here.x, here.y);
  const candidates = idsOf(mapObject)
    .filter((t) => mapObject[t]?.type === gathers && (mapObject[t]?.amount ?? 0) > 0)
    .map((t) => {
      const at = tile[t] as Tile;
      return {
        id: t,
        at,
        distance: tileDistance(map.width, hereIndex, tileIndex(map, at.x, at.y)),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.id - b.id);

  const blocked = blockedGrid(state, content);
  for (const c of candidates) {
    if (walkTo(state, content, id, standingTiles(state, blocked, c.at))) return c.id;
  }
  return null;
}

export function woodcuttingSystem(state: GameState, content: Content): void {
  const { woodcutter: tasks, villager, building, mapObject, path } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, or off work for the night.
    if (!task || !v || path[id] || v.routine !== 'work') continue;

    const job = content.jobs[v.job];
    const hutId = v.workplace;
    if (hutId === null) continue;
    const hut = building[hutId];
    const hutOrigin = state.components.tile[hutId];
    if (!hut || !hutOrigin) continue;
    const hutDef = content.buildings[hut.type];
    const buffer = hutDef.outputBuffer;
    if (!buffer) continue;
    const door = doorTile(hutDef, hutOrigin);
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        if ((hut.stock[buffer.resource] ?? 0) >= buffer.capacity) {
          idle(); // buffer full: wait for a carrier to take something
          break;
        }
        const tree = walkToNearestTree(state, content, id);
        if (tree === null) idle();
        else tasks[id] = { kind: 'toTree', tree };
        break;
      }
      case 'toTree': {
        const tree = mapObject[task.tree];
        if (tree && tree.amount > 0) {
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
          tasks[id] = { kind: 'idle', retryAt: state.tick }; // someone else finished it
        }
        break;
      }
      case 'chopping': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const tree = mapObject[task.tree];
        if (!tree || tree.amount <= 0) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        const def = content.mapObjects[tree.type];
        const amount = Math.min(def.yieldPerGather, tree.amount, job.carryCapacity);
        tree.amount -= amount;
        v.carrying = { resource: def.resource, amount };
        if (tree.amount === 0) destroyEntity(state, task.tree);
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
          const stock = hut.stock[carrying.resource] ?? 0;
          // Wait at the door for room, except after Dusk: then the logs go in even if it's full.
          if (stock + carrying.amount > buffer.capacity && !night) break;
          hut.stock[carrying.resource] = stock + carrying.amount;
          v.carrying = null;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
