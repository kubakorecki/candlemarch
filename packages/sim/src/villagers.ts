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
 * Whether villager `id` is a worker helping carry: it keeps its Job but holds a Haul, because its
 * Workplace couldn't use it (`logistics/helping.ts`). A Carrier holding one isn't.
 */
export function isHelpingCarry(state: GameState, id: EntityId): boolean {
  const v = state.components.villager[id];
  return v !== undefined && v.job !== 'carrier' && state.logistics.hauls[id] !== undefined;
}

/** The Jobs that dig Deposits or bog iron (`systems/digging.ts`). */
const DIGGER_JOBS: readonly JobId[] = ['quarryman', 'clay_digger', 'miner', 'bog_digger'];

/** Whether `job` digs Deposits or bog iron: its task is a `DiggerTask`. */
export function isDiggerJob(job: JobId): boolean {
  return DIGGER_JOBS.includes(job);
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
  delete state.components.digger[id];
  delete state.components.farmer[id];
  const type = workplace === null ? undefined : state.components.building[workplace]?.type;
  if (job === 'woodcutter') state.components.woodcutter[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'fisher') state.components.fisher[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'forager') state.components.forager[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'hunter') state.components.hunter[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'forester') state.components.forester[id] = { kind: 'idle', retryAt: 0 };
  else if (isDiggerJob(job)) state.components.digger[id] = { kind: 'idle', retryAt: 0 };
  else if (job === 'farmer') state.components.farmer[id] = { kind: 'idle', retryAt: 0 };
  else if (type && content.buildings[type].recipes) {
    state.components.crafter[id] = { kind: 'idle', retryAt: 0 };
  }
}

/** Adds a villager with `job` at `tile` (named `name`, else drawn), no Home, nothing in hand. */
export function spawnVillager(
  state: GameState,
  content: Content,
  job: JobId,
  tile: Tile,
  workplace: EntityId | null,
  name: string = drawVillagerName(state, content),
): EntityId {
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
    unhappyDawns: 0,
  };
  state.components.position[id] = tileCenter(tile);
  assignJob(state, content, id, job, workplace);
  return id;
}
