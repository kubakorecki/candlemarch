// Villagers: spawning and naming them, and giving them a Job, a Workplace and that Job's task state.
import type { Content, JobId } from '@candlemarch/content';
import { createEntity } from './entities';
import { tileCenter } from './grid';
import { randomInt } from './rng';
import type { EntityId, GameState, Tile, VillagerComponent } from './state';

/**
 * Draws a name for a new villager with the state's PRNG: one no living villager has, while any
 * are left, else any name from the pool. Candidates keep content order, so a seed always gives
 * the same names.
 */
export function drawVillagerName(state: GameState, content: Content): string {
  const pool = content.villagerNames;
  const taken = new Set(Object.values(state.components.villager).map((v) => v.name));
  const unused = pool.filter((name) => !taken.has(name));
  const candidates = unused.length > 0 ? unused : pool;
  const name = candidates[randomInt(state, candidates.length)];
  if (name === undefined) throw new Error('content has no villager names');
  return name;
}

/** The name a villager saved before names existed gets on load: the pool, in ID order. */
export function fallbackVillagerName(id: EntityId, content: Content): string {
  const pool = content.villagerNames;
  const name = pool[(id - 1) % pool.length];
  if (name === undefined) throw new Error('content has no villager names');
  return name;
}

/**
 * Whether villager `v` is at its Job: its routine is `work`, it isn't fighting and the Militia
 * bell hasn't called it.
 */
export function isAtWork(v: VillagerComponent): boolean {
  return v.routine === 'work' && !v.fighting && !v.militia;
}

/**
 * Gives villager `id` a Job and Workplace, replacing its old Job's task state with a fresh one
 * for the new Job. Anyone working at a workshop (a building with recipes) is a crafter. The
 * villager keeps whatever it carries and any walk in progress.
 */
export function assignJob(
  state: GameState,
  content: Content,
  id: EntityId,
  job: JobId,
  workplace: EntityId | null,
): void {
  const villager = state.components.villager[id];
  if (!villager) return;
  villager.job = job;
  villager.workplace = workplace;
  delete state.components.woodcutter[id];
  delete state.components.crafter[id];
  delete state.components.fisher[id];
  delete state.components.forager[id];
  delete state.components.hunter[id];
  delete state.components.forester[id];
  const type = workplace === null ? undefined : state.components.building[workplace]?.type;
  if (job === 'woodcutter') state.components.woodcutter[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'fisher') state.components.fisher[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'forager') state.components.forager[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'hunter') state.components.hunter[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'forester') state.components.forester[id] = { kind: 'idle', retryAt: 0 };
  else if (type && content.buildings[type].recipes) {
    state.components.crafter[id] = { kind: 'idle', retryAt: 0 };
  }
}

/** Adds a villager with `job` at `tile`, with no Home and nothing in hand. */
export function spawnVillager(
  state: GameState,
  content: Content,
  job: JobId,
  tile: Tile,
  workplace: EntityId | null,
): EntityId {
  const name = drawVillagerName(state, content);
  const id = createEntity(state);
  state.components.villager[id] = {
    name,
    job,
    workplace,
    carrying: null,
    home: null,
    routine: 'work',
    sleptTicks: 0,
    tired: false,
    missedMeals: 0,
    coldNights: 0,
    hp: content.combat.villager.hp,
    readyAt: 0,
    fighting: false,
    militia: false,
  };
  state.components.position[id] = tileCenter(tile);
  assignJob(state, content, id, job, workplace);
  return id;
}
