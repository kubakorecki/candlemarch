// Woodcutters: walk to the nearest tree, chop, carry the logs to their hut's output buffer, repeat.
import type { Content } from '@candlemarch/content';
import { destroyEntity, idsOf } from '../entities';
import { blockedGrid, doorTile, inBounds, tileIndex } from '../grid';
import { tileDistance } from '../pathfinding';
import type { EntityId, GameState, Tile } from '../state';
import { isAt, villagerTile, walkTo } from './movement';

/** Walkable tiles around `tile` (8 directions), where a gatherer can stand. */
function standingTiles(state: GameState, blocked: Uint8Array, tile: Tile): Tile[] {
  const result: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = tile.x + dx;
      const y = tile.y + dy;
      if (inBounds(state.map, x, y) && blocked[tileIndex(state.map, x, y)] === 0) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

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
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    if (!task || !v || path[id]) continue; // still walking

    const role = content.villagerRoles[v.role];
    const hut = v.workplace != null ? building[v.workplace] : undefined;
    const hutOrigin = v.workplace != null ? state.components.tile[v.workplace] : undefined;
    if (!hut || !hutOrigin) continue;
    const hutDef = content.buildings[hut.type];
    const buffer = hutDef.outputBuffer;
    if (!buffer) continue;
    const door = doorTile(hutDef, hutOrigin);
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + role.idleRetryTicks };
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
          const def = content.mapObjects[tree.type];
          tasks[id] = { kind: 'chopping', tree: task.tree, ticksLeft: def.gatherTicks };
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
        const amount = Math.min(def.yieldPerGather, tree.amount, role.carryCapacity);
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
          if (stock + carrying.amount > buffer.capacity) break; // wait at the door for room
          hut.stock[carrying.resource] = stock + carrying.amount;
          v.carrying = null;
        }
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
