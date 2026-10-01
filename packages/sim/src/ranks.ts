// The village's rank (spec, Progression): Camp, Hamlet, Village, Town. Each rank's content lists
// the buildings it unlocks; a rank building (the village hall...) may be placed only while the
// village has the rank's residents, and finishing it raises the rank. `state.rank` is the only
// thing stored.
import type { BuildingId, Content, RankDef, RankId } from '@candlemarch/content';
import type { GameState } from './state';

function rankIndex(content: Content, rank: RankId): number {
  return content.ranks.findIndex((r) => r.id === rank);
}

/** Villagers living in the village, Homeless or not; the Hero isn't one. */
export function residentCount(state: GameState): number {
  return Object.keys(state.components.villager).length;
}

/** The rank whose unlocks list `type`, or null for a building no rank unlocks (not placeable). */
function unlockedAt(content: Content, type: BuildingId): RankDef | null {
  return content.ranks.find((r) => r.unlocks.buildings.includes(type)) ?? null;
}

/** Why the rank keeps the player from placing a building, for the build menu. */
export type RankLock =
  /** Not unlocked yet: `rank` unlocks it. */
  | { kind: 'rank'; rank: RankId }
  /** A rank building while the village has fewer residents than its rank needs. */
  | { kind: 'residents'; residents: number; needed: number };

/** The rank `type` raises the village to once built, or null if it isn't a rank building. */
export function rankRaisedBy(content: Content, type: BuildingId): RankDef | null {
  return content.ranks.find((r) => r.building === type) ?? null;
}

/**
 * What keeps `type` from being placed at the village's rank, or null when the rank allows it:
 * unlocked at this rank or before, and for a rank building, the village has its residents.
 * A building no rank unlocks is locked behind the last rank.
 */
export function rankLock(state: GameState, content: Content, type: BuildingId): RankLock | null {
  const unlocking = unlockedAt(content, type);
  if (!unlocking || rankIndex(content, unlocking.id) > rankIndex(content, state.rank)) {
    const last = content.ranks[content.ranks.length - 1];
    return { kind: 'rank', rank: unlocking?.id ?? last?.id ?? state.rank };
  }
  const raises = rankRaisedBy(content, type);
  const residents = residentCount(state);
  if (raises && residents < raises.residents) {
    return { kind: 'residents', residents, needed: raises.residents };
  }
  return null;
}

/** Whether the rank lets the player place `type` now (`rankLock` is null). */
export function rankAllows(state: GameState, content: Content, type: BuildingId): boolean {
  return rankLock(state, content, type) === null;
}

/** Construction calls it as a building of `type` is finished: a rank building raises the rank. */
export function rankUp(state: GameState, content: Content, type: BuildingId): void {
  const rank = rankRaisedBy(content, type);
  if (rank && rankIndex(content, rank.id) > rankIndex(content, state.rank)) state.rank = rank.id;
}

/**
 * The village's rank and how far it is toward the next, for the HUD: the next rank's building,
 * residents against its requirement, and whether that building's site is under way. `next` is
 * null at the top, and below a rank whose building isn't in the game yet.
 */
export interface RankProgress {
  rank: RankId;
  next: {
    rank: RankId;
    building: BuildingId;
    residents: number;
    needed: number;
    underway: boolean;
  } | null;
}

export function rankProgress(state: GameState, content: Content): RankProgress {
  const next = content.ranks[rankIndex(content, state.rank) + 1];
  if (!next?.building) return { rank: state.rank, next: null };
  const building = next.building;
  return {
    rank: state.rank,
    next: {
      rank: next.id,
      building,
      residents: residentCount(state),
      needed: next.residents,
      underway: Object.values(state.components.site).some((s) => s.type === building),
    },
  };
}
