// Leaving the village (spec, Villagers: Happiness in M5). At each Dawn but the first, every
// villager counts the Dawn as Unhappy or not; one Unhappy `leaveAfterDawns` Dawns in a row leaves
// at that Dawn, unless the season is closed (winter: the roads are snowed in; it leaves at the
// first Dawn after). Leaving, it walks out of the entry; each tick, one that has got there, or
// whose walk ended short of it and can't go on, is gone. Runs after this Dawn's deaths, which
// count against everyone's score, and before immigration, which looks at the average.
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { destroyEntity, idsOf } from '../entities';
import { tileIndex } from '../grid';
import { happiness, happinessBand, isLeaving } from '../happiness';
import type { EntityId, GameState } from '../state';
import { releaseWorker } from '../workers';
import { isAt, rerouteTo } from './movement';

/**
 * Villager `id` quits the village, recorded in `state.departures`: drops its work as an unassigned
 * worker does, gives up its Job, Home and, a Master, its trade (lost to the village from now on),
 * then walks out of the entry. With no entry, or none it can walk to, or standing on it, it's
 * gone at once.
 */
export function leaveVillage(state: GameState, content: Content, id: EntityId): void {
  const v = state.components.villager[id];
  if (!v) return;
  const day = calendarAt(state.tick, content).day;
  state.departures.push({ name: v.name, trade: state.components.master[id]?.trade ?? null, day });
  releaseWorker(state, content, id);
  delete state.components.master[id];
  v.home = null;
  v.militia = false;
  v.routine = 'leaving';
  walkOut(state, content, id);
}

/**
 * Villager `id`, leaving, is out of the village and gone. The game is over when it was the last
 * villager.
 */
function depart(state: GameState, content: Content, id: EntityId): void {
  if (!state.components.villager[id]) return;
  const day = calendarAt(state.tick, content).day;
  delete state.logistics.hauls[id];
  destroyEntity(state, id);
  if (state.gameOver === null && idsOf(state.components.villager).length === 0) {
    state.gameOver = { day, cause: 'left' };
  }
}

/**
 * Villager `id`, leaving: walks on to the entry (`rerouteTo`, so one mid-step finishes it first).
 * Once there, or with no entry or none it can walk to, it's gone.
 */
function walkOut(state: GameState, content: Content, id: EntityId): void {
  const { entry } = state.map;
  if (entry === null || isAt(state, id, entry)) {
    depart(state, content, id);
    return;
  }
  const path = state.components.path[id];
  const goal = path?.tiles.at(-1);
  if (path && goal === tileIndex(state.map, entry.x, entry.y)) return;
  if (!rerouteTo(state, content, id, [entry])) depart(state, content, id);
}

export function happinessSystem(state: GameState, content: Content): void {
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v && isLeaving(v) && !v.fighting && !state.components.path[id]) {
      walkOut(state, content, id);
    }
  }
  // The game starts at Dawn on day 1, after no night.
  const { day, season } = calendarAt(state.tick, content);
  if (!isDawn(state.tick, content) || day === 1) return;
  const { leaveAfterDawns, closedSeasons } = content.happiness;
  const closed = closedSeasons.includes(season);
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || isLeaving(v)) continue;
    const unhappy = happinessBand(content, happiness(state, content, id)) === 'unhappy';
    v.unhappyDawns = unhappy ? v.unhappyDawns + 1 : 0;
    if (v.unhappyDawns >= leaveAfterDawns && !closed) leaveVillage(state, content, id);
  }
}
