// Night combat, worked out from state (nothing stored here): who Gloamlings may go for, what's in
// reach, who's fighting whom, and the health bars the client draws. The fighting itself is
// `systems/combat.ts`.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { entityDoor, tileIndex } from './grid';
import { housePlaces, isAtHome, residentsOf } from './homes';
import { gloamlingsNearBell } from './militia';
import { tileDistance } from './pathfinding';
import type { EntityId, GameState, Tile } from './state';
import { villagerTile } from './systems/movement';
import { fullHp } from './walls';
import { isOnWatch, towerFoe } from './watchtowers';

/**
 * Whether `id` is a villager out in the open (not indoors, nor a Watchman in its tower) or the
 * Hero, unless it's Knocked out.
 */
export function isOutInTheOpen(state: GameState, content: Content, id: EntityId): boolean {
  if (state.components.hero[id]) return !isKnockedOut(state, id);
  const v = state.components.villager[id];
  if (!v) return false;
  if (v.militia) return true;
  if (isOnWatch(state, content, id)) return false;
  return !isIndoors(state, content, id);
}

/**
 * Whether villager `id` is inside its Home, out of sight: asleep there, not called out by the
 * bell, and its door not broken in by a Gloamling.
 */
export function isIndoors(state: GameState, content: Content, id: EntityId): boolean {
  return isAsleepAtHome(state, content, id) && !isBrokenInOn(state, content, id);
}

/**
 * Whether villager `id` was asleep at Home when a Gloamling broke its door in: it's out in the
 * open and fights any Gloamling in its reach until Dawn.
 */
export function isBrokenInOn(state: GameState, content: Content, id: EntityId): boolean {
  const home = state.components.villager[id]?.home ?? null;
  return (
    home !== null && isAsleepAtHome(state, content, id) && state.components.building[home]?.hp === 0
  );
}

/** Whether villager `id` is asleep at its Home's door and not called out by the bell. */
function isAsleepAtHome(state: GameState, content: Content, id: EntityId): boolean {
  const v = state.components.villager[id];
  return !!v && !v.militia && v.routine === 'asleep' && isAtHome(state, content, id);
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

/**
 * The building Gloamling `id` is battering: its target, a House (at its door) or a wall segment
 * still standing, within its reach. Null when it isn't battering.
 */
export function batteredBy(state: GameState, content: Content, id: EntityId): EntityId | null {
  const target = state.components.gloamling[id]?.target ?? null;
  if (target === null) return null;
  const hp = state.components.building[target]?.hp ?? null;
  const at = targetTile(state, content, target);
  const here = villagerTile(state, id);
  if (hp === null || hp <= 0 || !at || !here) return null;
  return chebyshev(here, at) <= content.combat.gloamling.reachTiles ? target : null;
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

/**
 * The Gloamling villager `id` goes for while the Militia bell has called it: the nearest (tile
 * distance) within the bell's range, ties to the lowest ID. Null when it isn't called or none is.
 */
export function militiaTarget(state: GameState, content: Content, id: EntityId): EntityId | null {
  if (!state.components.villager[id]?.militia) return null;
  return nearestTo(state, id, gloamlingsNearBell(state, content));
}

/**
 * The Gloamling villager `id` hits: one attacking it (`opponentOf`), else, while the Militia bell
 * has called it, the nearest in its reach within the bell's range, else, broken in on
 * (`isBrokenInOn`), the nearest in its reach. Null when there's none.
 */
export function villagerFoe(state: GameState, content: Content, id: EntityId): EntityId | null {
  const attacker = opponentOf(state, content, id);
  if (attacker !== null) return attacker;
  const { reachTiles } = content.combat.villager;
  const reached = (gloamlings: EntityId[]) =>
    nearestTo(
      state,
      id,
      gloamlings.filter((g) => inReach(state, id, g, reachTiles)),
    );
  if (state.components.villager[id]?.militia) return reached(gloamlingsNearBell(state, content));
  if (isBrokenInOn(state, content, id)) return reached(idsOf(state.components.gloamling));
  return null;
}

/** Whether Hero `id` is Knocked out. */
export function isKnockedOut(state: GameState, id: EntityId): boolean {
  return (state.components.hero[id]?.knockedOutUntil ?? null) !== null;
}

/** Whether Den `den` is within `reachTiles` of `id` (Chebyshev, from the tile `id` stands on). */
export function denInReach(
  state: GameState,
  id: EntityId,
  den: EntityId,
  reachTiles: number,
): boolean {
  const at = villagerTile(state, id);
  const denTile = state.components.den[den] ? state.components.tile[den] : undefined;
  return at !== null && denTile !== undefined && chebyshev(at, denTile) <= reachTiles;
}

/**
 * Who Den `den` stings: every villager out in the open and the Hero (unless Knocked out) within
 * its reach, in ID order. Never Gloamlings.
 */
export function stungBy(state: GameState, content: Content, den: EntityId): EntityId[] {
  const { villager, hero } = state.components;
  const { reachTiles } = content.combat.den;
  return [...idsOf(villager), ...idsOf(hero)]
    .sort((a, b) => a - b)
    .filter((id) => isOutInTheOpen(state, content, id) && denInReach(state, id, den, reachTiles));
}

/**
 * What Hero `id` hits: the Gloamling it's ordered to attack when that's in reach, else the
 * nearest Gloamling in its reach (tile distance), ties to the lowest ID, else the Den it's
 * ordered to attack when that's in reach. Null while it's Knocked out or none is in reach.
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
  const gloamling = nearestTo(state, id, inReachOf);
  if (gloamling !== null) return gloamling;
  const den = hero.order?.kind === 'attackDen' ? hero.order.den : null;
  return den !== null && denInReach(state, id, den, reachTiles) ? den : null;
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

/** A health bar over someone in a fight, or over a building Gloamlings batter. */
export interface HealthBar {
  id: EntityId;
  hp: number;
  maxHp: number;
  /**
   * A battered building's: the tile it's battered at (a House's door, a wall's own tile); a Den's
   * own tile.
   */
  tile?: Tile;
}

/**
 * Health of everyone in a fight right now: villagers fighting back or with a Gloamling to hit in
 * the militia, the Hero with a Gloamling or its Den in reach, Gloamlings engaged or in a manned
 * watchtower's sights, each House door or wall segment being battered, and each Den the Hero hits.
 */
export function healthBars(state: GameState, content: Content): HealthBar[] {
  const { villager, gloamling, hero } = state.components;
  const bars: HealthBar[] = [];
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (v && (v.fighting || villagerFoe(state, content, id) !== null))
      bars.push({ id, hp: v.hp, maxHp: content.combat.villager.hp });
  }
  const dens = new Set<EntityId>();
  for (const id of idsOf(hero)) {
    const h = hero[id];
    const foe = h ? heroFoe(state, content, id) : null;
    if (h && foe !== null) {
      bars.push({ id, hp: h.hp, maxHp: content.combat.hero.hp });
      if (state.components.den[foe]) dens.add(foe);
    }
  }
  for (const id of [...dens].sort((a, b) => a - b)) {
    const d = state.components.den[id];
    const tile = state.components.tile[id];
    if (d && tile) bars.push({ id, hp: d.hp, maxHp: content.combat.den.hp, tile });
  }
  const shot = new Set(idsOf(villager).map((id) => towerFoe(state, content, id)));
  for (const id of idsOf(gloamling)) {
    const g = gloamling[id];
    if (g && (isEngaged(state, content, id) || shot.has(id))) {
      bars.push({ id, hp: g.hp, maxHp: content.combat.gloamling.hp });
    }
  }
  const battered = new Set<EntityId>();
  for (const id of idsOf(gloamling)) {
    const b = batteredBy(state, content, id);
    if (b !== null) battered.add(b);
  }
  for (const id of [...battered].sort((a, b) => a - b)) {
    const b = state.components.building[id];
    const maxHp = b && fullHp(content, b.type);
    const tile = targetTile(state, content, id);
    if (b?.hp != null && maxHp && tile) bars.push({ id, hp: b.hp, maxHp, tile });
  }
  return bars;
}
