// Night combat, worked out from state (nothing stored here): who Gloamlings may go for, what's in
// reach, who's fighting whom, and the health bars the client draws. The fighting itself is
// `systems/combat.ts`.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor, tileIndex } from './grid';
import { housePlaces, isAtHome, residentsOf } from './homes';
import { tileDistance } from './pathfinding';
import type { EntityId, GameState, Tile } from './state';
import { villagerTile } from './systems/movement';

/**
 * Whether `id` is a villager out in the open (not asleep at Home) or the Hero, unless it's
 * Knocked out.
 */
export function isOutInTheOpen(state: GameState, content: Content, id: EntityId): boolean {
  if (state.components.hero[id]) return !isKnockedOut(state, id);
  const v = state.components.villager[id];
  if (!v) return false;
  return !(v.routine === 'asleep' && isAtHome(state, content, id));
}

/** Whether `house` is a House somebody lives in. */
export function isLivedInHouse(state: GameState, content: Content, house: EntityId): boolean {
  return housePlaces(state, content, house) > 0 && residentsOf(state, house).length > 0;
}

/** Whether `a` and `b` stand within `reachTiles` tiles of each other (Chebyshev). */
export function inReach(state: GameState, a: EntityId, b: EntityId, reachTiles: number): boolean {
  const at = villagerTile(state, a);
  const bt = villagerTile(state, b);
  return at !== null && bt !== null && chebyshev(at, bt) <= reachTiles;
}

export function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Whether Gloamling `id` has a villager or the Hero in reach as its target. */
export function isEngaged(state: GameState, content: Content, id: EntityId): boolean {
  const target = state.components.gloamling[id]?.target ?? null;
  if (target === null || state.components.building[target]) return false;
  return inReach(state, id, target, content.combat.gloamling.reachTiles);
}

/** Gloamlings going for villager `id` with it in reach, in ID order. */
export function attackersOf(state: GameState, content: Content, id: EntityId): EntityId[] {
  const { gloamling } = state.components;
  return idsOf(gloamling).filter(
    (g) => gloamling[g]?.target === id && isEngaged(state, content, g),
  );
}

/**
 * The Gloamling villager `id` hits back: of those attacking it, the nearest (tile distance, as
 * they're all a step away), ties to the lowest ID. Null when none is.
 */
export function opponentOf(state: GameState, content: Content, id: EntityId): EntityId | null {
  return nearestTo(state, id, attackersOf(state, content, id));
}

/** Whether Hero `id` is Knocked out. */
export function isKnockedOut(state: GameState, id: EntityId): boolean {
  return (state.components.hero[id]?.knockedOutUntil ?? null) !== null;
}

/**
 * The Gloamling Hero `id` hits: the one it's ordered to attack when that's in reach, else the
 * nearest in its reach (tile distance), ties to the lowest ID. Null while it's Knocked out or
 * none is in reach.
 */
export function heroFoe(state: GameState, content: Content, id: EntityId): EntityId | null {
  const hero = state.components.hero[id];
  if (!hero || isKnockedOut(state, id)) return null;
  const { reachTiles } = content.combat.hero;
  const ordered = hero.order?.kind === 'attack' ? hero.order.gloamling : null;
  if (
    ordered !== null &&
    state.components.gloamling[ordered] &&
    inReach(state, id, ordered, reachTiles)
  ) {
    return ordered;
  }
  const inReachOf = idsOf(state.components.gloamling).filter((g) =>
    inReach(state, id, g, reachTiles),
  );
  return nearestTo(state, id, inReachOf);
}

/** Of `ids` (ascending), the one nearest `id` by tile distance, ties to the lowest ID. */
function nearestTo(state: GameState, id: EntityId, ids: readonly EntityId[]): EntityId | null {
  const here = villagerTile(state, id);
  if (!here) return null;
  const { map } = state;
  let best: { id: EntityId; distance: number } | null = null;
  for (const other of ids) {
    const t = villagerTile(state, other);
    if (!t) continue;
    const distance = tileDistance(
      map.width,
      tileIndex(map, here.x, here.y),
      tileIndex(map, t.x, t.y),
    );
    if (!best || distance < best.distance) best = { id: other, distance };
  }
  return best?.id ?? null;
}

/**
 * Where a Gloamling goes for `target`: the tile a villager or the Hero stands on, or a House's
 * door. Null if it's gone.
 */
export function targetTile(state: GameState, content: Content, target: EntityId): Tile | null {
  if (state.components.building[target]) return entityDoor(state, content, target);
  return villagerTile(state, target);
}

/** A health bar over someone in a fight. */
export interface HealthBar {
  id: EntityId;
  hp: number;
  maxHp: number;
}

/**
 * Health of everyone in a fight right now: villagers fighting back, the Hero with a Gloamling in
 * reach, Gloamlings engaged.
 */
export function healthBars(state: GameState, content: Content): HealthBar[] {
  const { villager, gloamling, hero } = state.components;
  const bars: HealthBar[] = [];
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v?.fighting) bars.push({ id, hp: v.hp, maxHp: content.combat.villager.hp });
  }
  for (const id of idsOf(hero)) {
    const h = hero[id];
    if (h && heroFoe(state, content, id) !== null) {
      bars.push({ id, hp: h.hp, maxHp: content.combat.hero.hp });
    }
  }
  for (const id of idsOf(gloamling)) {
    const g = gloamling[id];
    if (g && isEngaged(state, content, id)) {
      bars.push({ id, hp: g.hp, maxHp: content.combat.gloamling.hp });
    }
  }
  return bars;
}
