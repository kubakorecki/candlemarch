// The Militia bell (spec, Nights in v1). Ringing it calls every villager to arms: they drop their
// work by the unassign rule and walk to the bell, where they fight Gloamlings within its range
// (`systems/militia.ts`, `systems/combat.ts`). Ringing it again, or Dawn, stands them down: back
// to their Jobs by day, Home by night. Nothing else is stored: the bell rings while anyone is
// called.
// Watchmen aren't called: they sleep by day and stay in their watchtowers by night.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import type { EntityId, GameState } from './state';
import { stopAtNextTile, villagerTile } from './systems/movement';
import { isWatchman } from './watchtowers';
import { dropWork } from './workers';

/** The village's Militia bell, or null while it has none built. */
export function bellOf(state: GameState, content: Content): EntityId | null {
  const { building } = state.components;
  return (
    idsOf(building).find((id) => {
      const b = building[id];
      return b !== undefined && content.buildings[b.type].bell !== undefined;
    }) ?? null
  );
}

/** Whether the bell has called the village to arms: some villager is in the militia. */
export function isBellRung(state: GameState): boolean {
  return Object.values(state.components.villager).some((v) => v.militia);
}

/**
 * Rings the bell: calls every villager but Watchmen to arms, or stands them down if it's already
 * ringing. Ignored while the village has no bell.
 */
export function ringBell(state: GameState, content: Content): void {
  if (bellOf(state, content) === null) return;
  if (isBellRung(state)) {
    standDown(state);
    return;
  }
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || isWatchman(v)) continue;
    dropWork(state, content, id);
    v.militia = true;
  }
}

/**
 * Sends the militia back: each stops at the next tile and its routine carries on from there, to
 * its Job by day; by night to the Granary or Home, as far as it had got before it was called.
 */
export function standDown(state: GameState): void {
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v?.militia) continue;
    v.militia = false;
    // Called out of bed: it walks Home again.
    if (v.routine === 'asleep') v.routine = 'goingHome';
    stopAtNextTile(state, id);
  }
}

/** Gloamlings within the bell's range (Chebyshev, from its tile), in ID order. */
export function gloamlingsNearBell(state: GameState, content: Content): EntityId[] {
  const bell = bellOf(state, content);
  const at = bell === null ? undefined : state.components.tile[bell];
  const b = bell === null ? undefined : state.components.building[bell];
  const range = b ? content.buildings[b.type].bell?.rangeTiles : undefined;
  if (!at || range === undefined) return [];
  return idsOf(state.components.gloamling).filter((g) => {
    const t = villagerTile(state, g);
    return t !== null && Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y)) <= range;
  });
}
