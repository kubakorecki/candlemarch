// Happiness (spec, Villagers: Happiness in M5). Each villager has a score from 0 to
// `happiness.max`: `happiness.start` plus its sources, worked out from state each time it's asked
// (nothing stored but the Unhappy Dawns in a row). It's about the good life, not survival: Hungry,
// Cold and Tired keep their own slowdowns and don't count here. The band (Happy, Content,
// Unhappy) speeds or slows work; Unhappy too long, a villager leaves the village.
import type { Content } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import type { EntityId, GameState, VillagerComponent } from './state';

/** One thing raising or lowering a villager's score, and by how much. */
export type HappinessSource =
  | { kind: 'homeless'; value: number }
  /** Deaths in the village on the last `deathDays` days. */
  | { kind: 'deaths'; deaths: number; value: number };

/** Happy (works faster), Content, or Unhappy (works slower, and leaves if it lasts). */
export type HappinessBand = 'happy' | 'content' | 'unhappy';

/** Whether villager `v` has quit the village and is walking out of it. */
export function isLeaving(v: VillagerComponent): boolean {
  return v.routine === 'leaving';
}

/** Deaths in the village on the last `deathDays` days, today included. */
function recentDeaths(state: GameState, content: Content): number {
  const today = calendarAt(state.tick, content).day;
  let count = 0;
  // Deaths are recorded oldest first.
  for (let i = state.deaths.length - 1; i >= 0; i--) {
    const death = state.deaths[i];
    if (!death || today - death.day >= content.happiness.deathDays) break;
    count += 1;
  }
  return count;
}

/** What raises or lowers villager `id`'s score now, in a fixed order; empty for none. */
export function happinessSources(
  state: GameState,
  content: Content,
  id: EntityId,
): HappinessSource[] {
  const v = state.components.villager[id];
  if (!v) return [];
  const sources: HappinessSource[] = [];
  if (v.home === null) sources.push({ kind: 'homeless', value: content.happiness.homeless });
  const deaths = recentDeaths(state, content);
  if (deaths > 0) sources.push({ kind: 'deaths', deaths, value: deaths * content.happiness.death });
  return sources;
}

/** Villager `id`'s score: the start plus its sources, from 0 to `happiness.max`. */
export function happiness(state: GameState, content: Content, id: EntityId): number {
  let score = content.happiness.start;
  for (const source of happinessSources(state, content, id)) score += source.value;
  return Math.min(content.happiness.max, Math.max(0, score));
}

/** The band a score falls in. */
export function happinessBand(content: Content, score: number): HappinessBand {
  if (score >= content.happiness.happyAt) return 'happy';
  if (score < content.happiness.unhappyBelow) return 'unhappy';
  return 'content';
}

/**
 * How fast villager `id` works for its happiness, as a percent of normal: Happy
 * `happySpeedPercent`, Unhappy `unhappySpeedPercent`, else 100 (and 100 for anyone not a
 * villager, such as the Hero).
 */
export function happinessSpeedPercent(state: GameState, content: Content, id: EntityId): number {
  if (!state.components.villager[id]) return 100;
  const band = happinessBand(content, happiness(state, content, id));
  if (band === 'happy') return content.happiness.happySpeedPercent;
  if (band === 'unhappy') return content.happiness.unhappySpeedPercent;
  return 100;
}

/**
 * Whether the villagers' average score is in the Unhappy band (those leaving don't count). No
 * Newcomer comes while it is.
 */
export function isVillageUnhappy(state: GameState, content: Content): boolean {
  const { villager } = state.components;
  let total = 0;
  let count = 0;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || isLeaving(v)) continue;
    total += happiness(state, content, id);
    count += 1;
  }
  return count > 0 && total < content.happiness.unhappyBelow * count;
}
