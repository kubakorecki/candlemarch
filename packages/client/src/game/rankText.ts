// Pure wording of the village's rank: the Almanac's rank line and why a build card is locked.
import { content, type RankId } from '@candlemarch/content';
import type { RankLock, RankProgress } from '@candlemarch/sim';

function rankName(rank: RankId): string {
  return content.ranks.find((r) => r.id === rank)?.name ?? rank;
}

/** The rank, and the way to the next: "Toward Hamlet: 7/10 residents", or null at the top. */
export function rankText(progress: RankProgress): { rank: string; next: string | null } {
  const { next } = progress;
  if (!next) return { rank: rankName(progress.rank), next: null };
  const building = content.buildings[next.building].name;
  const toward = `Toward ${rankName(next.rank)}`;
  let step: string;
  if (next.underway) step = `the ${building} is being built`;
  else if (next.residents < next.needed) step = `${next.residents}/${next.needed} residents`;
  else step = `build a ${building}`;
  return { rank: rankName(progress.rank), next: `${toward}: ${step}` };
}

/** A locked build card's short line: "Hamlet", "7/10 residents". */
export function lockCardText(lock: RankLock): string {
  return lock.kind === 'rank' ? rankName(lock.rank) : `${lock.residents}/${lock.needed} residents`;
}

/** Why a building can't be placed yet: "Unlocked at Hamlet.", "Needs 10 residents: 7/10." */
export function lockText(lock: RankLock): string {
  return lock.kind === 'rank'
    ? `Unlocked at ${rankName(lock.rank)}.`
    : `Needs ${lock.needed} residents: ${lock.residents}/${lock.needed}.`;
}
