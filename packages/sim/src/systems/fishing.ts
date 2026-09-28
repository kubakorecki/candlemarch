// Fishers: stand at their hut's door on the riverbank and fish, putting each catch straight into
// the hut's output buffer. Fish never run out; nothing is caught while the river is frozen.
import type { Content } from '@candlemarch/content';
import { isRiverFrozen } from '../calendar';
import { idsOf } from '../entities';
import { doorTile } from '../grid';
import { workTicks } from '../speed';
import type { GameState } from '../state';
import { isAt, walkTo } from './movement';

export function fishingSystem(state: GameState, content: Content): void {
  const { fisher: tasks, villager, building, tile, path } = state.components;
  const frozen = isRiverFrozen(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, or off work for the night.
    if (!task || !v || path[id] || v.workplace === null || v.routine !== 'work') continue;
    const hutId = v.workplace;
    const hut = building[hutId];
    const origin = tile[hutId];
    if (!hut || !origin) continue;
    const def = content.buildings[hut.type];
    const buffer = def.outputBuffer?.[0]; // a fishing building has one output: its catch
    if (!def.fishes || !buffer) continue;
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + content.jobs[v.job].idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        const door = doorTile(def, origin, hut.rotation);
        if (!isAt(state, id, door)) {
          if (!walkTo(state, content, id, [door])) idle();
          break;
        }
        const stock = hut.stock[buffer.resource] ?? 0;
        if (frozen || stock + def.fishes.yieldPerCatch > buffer.capacity) {
          idle(); // frozen river, or buffer full: wait for a carrier to take something
          break;
        }
        // A hero's aura near the hut when the catch starts speeds up the whole catch.
        const ticksLeft = workTicks(state, content, id, hutId, def.fishes.catchTicks);
        tasks[id] = { kind: 'fishing', ticksLeft };
        break;
      }
      case 'fishing': {
        if (frozen) {
          idle(); // the river froze over mid-catch: it's lost
          break;
        }
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const stock = hut.stock[buffer.resource] ?? 0;
        hut.stock[buffer.resource] = stock + def.fishes.yieldPerCatch;
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
