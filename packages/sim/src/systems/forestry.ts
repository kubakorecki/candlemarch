// Foresters: walk to the nearest tile in their lodge's radius they may plant on, plant a Sapling
// there, repeat. With nothing left to plant they wait and look again.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import { canPlant, plantableTiles, plantSapling } from '../forest';
import { tileIndex } from '../grid';
import { tileDistance } from '../pathfinding';
import { workTicks } from '../speed';
import type { EntityId, GameState, Tile } from '../state';
import { isAtWork } from '../villagers';
import { isAt, villagerTile, walkTo } from './movement';

export function forestrySystem(state: GameState, content: Content): void {
  const { forester: tasks, villager, building, path } = state.components;
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, or off work for the night.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    const lodgeId = v.workplace;
    const lodge = building[lodgeId];
    const plants = lodge ? content.buildings[lodge.type].plants : undefined;
    if (!plants) continue;
    const job = content.jobs[v.job];

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const plot = walkToNearestPlot(state, content, id, lodgeId);
        if (plot === null) tasks[id] = { kind: 'idle', retryAt: state.tick + job.idleRetryTicks };
        else tasks[id] = { kind: 'toPlot', plot };
        break;
      }
      case 'toPlot': {
        // Arrived, or the walk was cut short: plant only on the plot, while it's still free.
        if (!isAt(state, id, task.plot) || !canPlant(state, content, lodgeId, task.plot)) {
          tasks[id] = { kind: 'idle', retryAt: state.tick };
          break;
        }
        // A hero's aura near the lodge when the planting starts speeds up the whole planting.
        const ticksLeft = workTicks(state, content, id, lodgeId, plants.plantTicks);
        tasks[id] = { kind: 'planting', plot: task.plot, ticksLeft };
        break;
      }
      case 'planting': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        if (canPlant(state, content, lodgeId, task.plot)) plantSapling(state, content, task.plot);
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}

/**
 * Starts forester `id` walking to the nearest tile lodge `lodgeId` lets it plant on that no other
 * forester is going to or planting (tile distance from where it stands, ties row-major), skipping
 * those it can't reach. Returns that tile, or null.
 */
function walkToNearestPlot(
  state: GameState,
  content: Content,
  id: EntityId,
  lodgeId: EntityId,
): Tile | null {
  const here = villagerTile(state, id);
  if (!here) return null;
  const { map } = state;
  const taken = new Set<number>();
  for (const other of idsOf(state.components.forester)) {
    const task = state.components.forester[other];
    if (other !== id && task && task.kind !== 'idle') {
      taken.add(tileIndex(map, task.plot.x, task.plot.y));
    }
  }
  const hereIndex = tileIndex(map, here.x, here.y);
  const plots = plantableTiles(state, content, lodgeId)
    .map((t) => ({ t, i: tileIndex(map, t.x, t.y) }))
    .filter(({ i }) => !taken.has(i))
    .map(({ t, i }) => ({ t, i, distance: tileDistance(map.width, hereIndex, i) }))
    .sort((a, b) => a.distance - b.distance || a.i - b.i);
  for (const { t } of plots) {
    if (walkTo(state, content, id, [t])) return t;
  }
  return null;
}
