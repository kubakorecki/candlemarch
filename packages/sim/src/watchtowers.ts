// Watchtowers (spec, Nights in v1). A tower's worker, its Watchman, works the night shift: it eats
// at Dusk, stands in the tower till Dawn and sleeps at Home by day (`systems/routine.ts`). While
// it's in the tower, the tower shoots the nearest Gloamling in range (`systems/combat.ts`), timed
// by the Watchman's `readyAt`. Towers can't be attacked, and a Watchman in its tower can't either.
// Nothing is stored here.
import type { Content, WatchDef } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor } from './grid';
import type { EntityId, GameState, Tile, VillagerComponent } from './state';
import { isAt, villagerTile } from './systems/movement';

/** Whether villager `v` is a Watchman: it works nights and sleeps by day. */
export function isWatchman(v: VillagerComponent): boolean {
  return v.job === 'watchman';
}

/** The watchtower villager `id` works the night shift in, or null when it has none. */
export function towerOf(state: GameState, content: Content, id: EntityId): EntityId | null {
  const v = state.components.villager[id];
  if (!v || !isWatchman(v) || v.workplace === null) return null;
  const b = state.components.building[v.workplace];
  return b && content.buildings[b.type].watch ? v.workplace : null;
}

/** Door of Watchman `id`'s tower, where it stands on watch, or null when it has no tower. */
export function towerDoor(state: GameState, content: Content, id: EntityId): Tile | null {
  const tower = towerOf(state, content, id);
  return tower === null ? null : entityDoor(state, content, tower);
}

/** Whether villager `id` is a Watchman standing in its tower on its night shift. */
export function isOnWatch(state: GameState, content: Content, id: EntityId): boolean {
  const door = towerDoor(state, content, id);
  return (
    state.components.villager[id]?.routine === 'onWatch' && door !== null && isAt(state, id, door)
  );
}

/** The watch numbers of Watchman `id`'s tower, or null when it has none. */
export function watchOf(state: GameState, content: Content, id: EntityId): WatchDef | null {
  const tower = towerOf(state, content, id);
  const b = tower === null ? undefined : state.components.building[tower];
  return b ? (content.buildings[b.type].watch ?? null) : null;
}

/**
 * The Gloamling Watchman `id`'s tower shoots: while it's on watch, the nearest within the tower's
 * `rangeTiles` of its tile (Chebyshev), ties to the lowest ID. Null otherwise.
 */
export function towerFoe(state: GameState, content: Content, id: EntityId): EntityId | null {
  if (!isOnWatch(state, content, id)) return null;
  const tower = towerOf(state, content, id);
  const at = tower === null ? undefined : state.components.tile[tower];
  const watch = watchOf(state, content, id);
  if (!at || !watch) return null;
  let best: { id: EntityId; distance: number } | null = null;
  for (const g of idsOf(state.components.gloamling)) {
    const t = villagerTile(state, g);
    if (!t) continue;
    const distance = Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y));
    if (distance <= watch.rangeTiles && (!best || distance < best.distance)) {
      best = { id: g, distance };
    }
  }
  return best?.id ?? null;
}
