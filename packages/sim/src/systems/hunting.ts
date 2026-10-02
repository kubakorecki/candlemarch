// Hunters: walk into the nearest Hunting ground their lodge hunts that has Game, hunt, roll
// for a catch with the seeded PRNG, and walk back to the lodge, with the catch or empty-handed.

import type { Content, ResourceAmount } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { blockedGrid, doorTile, tileIndex } from '../grid';
import { groundTilesInReach, huntChancePermille, lodgeGrounds, loseGame } from '../huntingGrounds';
import { tileDistance } from '../pathfinding';
import { randomInt } from '../rng';
import { workTicks } from '../speed';
import { isPaused } from '../standingOrders';
import type { EntityId, GameState, Tile } from '../state';
import { holdsTool } from '../tools';
import { isAtWork, isHelpingCarry } from '../villagers';
import { fitsInYard } from '../yards';
import { isAt, villagerTile, walkTo } from './movement';

/**
 * Starts hunter `id` walking into the nearest Hunting ground lodge `lodgeId` hunts (its chosen
 * one, else any in its radius; `lodgeGrounds`) that has Game (walking distance to its nearest
 * open tile in reach, ties by ID). Returns that ground, or null when every such ground is empty or
 * can't be reached.
 */
function walkToGround(
  state: GameState,
  content: Content,
  id: EntityId,
  lodgeId: EntityId,
): EntityId | null {
  const here = villagerTile(state, id);
  if (!here) return null;
  const { map, components } = state;
  const blocked = blockedGrid(state, content);
  const hereIndex = tileIndex(map, here.x, here.y);
  const candidates = lodgeGrounds(state, content, lodgeId)
    .filter((g) => (components.huntingGround[g]?.game ?? 0) > 0)
    .map((g) => {
      const tiles = groundTilesInReach(state, content, lodgeId, g).filter(
        (t) => !blocked[tileIndex(map, t.x, t.y)],
      );
      const distances = tiles.map((t) =>
        tileDistance(map.width, hereIndex, tileIndex(map, t.x, t.y)),
      );
      return { id: g, tiles, distance: Math.min(...distances) };
    })
    .filter((c) => c.tiles.length > 0)
    .sort((a, b) => a.distance - b.distance || a.id - b.id);
  for (const c of candidates) {
    if (walkTo(state, content, id, c.tiles)) return c.id;
  }
  return null;
}

/**
 * What a catch of hunter `id` at lodge `lodgeId` is: the lodge's `hunts.catch`, less what needs a
 * tool when the hunter holds none.
 */
function catchOf(
  state: GameState,
  content: Content,
  id: EntityId,
  lodgeId: EntityId,
): ResourceAmount[] {
  const lodge = state.components.building[lodgeId];
  const hunts = lodge ? content.buildings[lodge.type].hunts : undefined;
  const tool = holdsTool(state, id, lodgeId);
  return (hunts?.catch ?? [])
    .filter((c) => tool || !c.needsTool)
    .map(({ resource, amount }) => ({ resource, amount }));
}

export function huntingSystem(state: GameState, content: Content): void {
  const { hunter: tasks, villager, building, huntingGround, path, tile } = state.components;
  const night = isNight(state.tick, content);
  for (const id of idsOf(tasks)) {
    const task = tasks[id];
    const v = villager[id];
    // Still walking, off work for the night, or helping carry.
    if (!task || !v || path[id] || v.workplace === null || !isAtWork(v)) continue;
    if (isHelpingCarry(state, id)) continue;
    const lodgeId = v.workplace;
    const lodge = building[lodgeId];
    const origin = tile[lodgeId];
    if (!lodge || !origin) continue;
    const def = content.buildings[lodge.type];
    if (!def.hunts) continue;
    const door: Tile = doorTile(def, origin, lodge.rotation);

    switch (task.kind) {
      case 'idle': {
        if (state.tick < task.retryAt) break;
        // Paused by its standing order, yard too full for a whole catch, or no Game in reach: wait
        // and look again.
        const ground =
          !isPaused(state, content, lodgeId) &&
          fitsInYard(state, content, lodgeId, catchOf(state, content, id, lodgeId))
            ? walkToGround(state, content, id, lodgeId)
            : null;
        if (ground === null) {
          tasks[id] = { kind: 'idle', retryAt: state.tick + content.jobs[v.job].idleRetryTicks };
        } else {
          tasks[id] = { kind: 'toGround', ground };
        }
        break;
      }
      case 'toGround': {
        if ((huntingGround[task.ground]?.game ?? 0) > 0) {
          // A hero's aura near the lodge when the hunt starts speeds up the whole hunt.
          const ticksLeft = workTicks(state, content, id, lodgeId, def.hunts.huntTicks);
          tasks[id] = { kind: 'hunting', ground: task.ground, ticksLeft };
        } else {
          tasks[id] = { kind: 'idle', retryAt: state.tick }; // emptied meanwhile
        }
        break;
      }
      case 'hunting': {
        task.ticksLeft -= 1;
        if (task.ticksLeft > 0) break;
        const ground = huntingGround[task.ground];
        const chance = ground ? huntChancePermille(ground, content) : 0;
        const caught = randomInt(state, 1000) < chance;
        if (ground && caught) loseGame(state, content, ground, 1);
        const bag = caught ? catchOf(state, content, id, lodgeId) : [];
        tasks[id] = { kind: 'toLodge', bag };
        walkTo(state, content, id, [door]);
        break;
      }
      case 'toLodge': {
        if (!isAt(state, id, door)) {
          walkTo(state, content, id, [door]); // walk was cut short or blocked; try again
          break;
        }
        // Wait at the door for room, except after Dusk: then the catch goes in even if it's full.
        if (!fitsInYard(state, content, lodgeId, task.bag) && !night) break;
        for (const c of task.bag)
          lodge.stock[c.resource] = (lodge.stock[c.resource] ?? 0) + c.amount;
        tasks[id] = { kind: 'idle', retryAt: state.tick };
        break;
      }
    }
  }
}
