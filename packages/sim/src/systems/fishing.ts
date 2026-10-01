// Fishers: stand at their hut's door on the riverbank and fish, putting each catch straight into
// the hut's yard (its output buffer). Fish never run out; nothing is caught while the river is
// frozen.

import type { Content } from '@candlemarch/content';
import { isRiverFrozen } from '../calendar';
import { idsOf } from '../entities';
import { doorTile } from '../grid';
import { workTicks } from '../speed';
import type { GameState } from '../state';
import { isAtWork, isHelpingCarry } from '../villagers';
import { fitsInYard } from '../yards';
import { isAt, walkTo } from './movement';

export function fishingSystem(state: GameState, content: Content): void {
  const { fisher: tasks, villager, building, tile, path } = state.components;
  const frozen = isRiverFrozen(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, off work for the night, or helping carry.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    if (isHelpingCarry(state, id)) continue;
    const hutId = v.workplace;
    const hut = building[hutId];
    const origin = tile[hutId];
    if (!hut || !origin) continue;
    const def = content.buildings[hut.type];
    const fish = def.outputBuffer?.resources[0]; // a fishing building has one output: its catch
    if (!def.fishes || !fish) continue;
    const haul = [{ resource: fish, amount: def.fishes.yieldPerCatch }];
    const idle = () => {
      tasks[id] = { kind: 'idle', retryAt: state.tick + content.jobs[v.job].idleRetryTicks };
    };

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        if (!fitsInYard(state, content, hutId, haul)) {
          idle(); // yard full: wait where it stands (helping carry) for room
          break;
        }
        const door = doorTile(def, origin, hut.rotation);
        if (!isAt(state, id, door)) {
          if (!walkTo(state, content, id, [door])) idle();
          break;
        }
        if (frozen) {
          idle(); // frozen river: wait at the door
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
        hut.stock[fish] = (hut.stock[fish] ?? 0) + def.fishes.yieldPerCatch;
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
