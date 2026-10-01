// Night combat, resolved on its own. Each tick every Gloamling picks what to go for and walks
// there; a villager a Gloamling reaches drops its work and hits back; then everyone in reach and
// off cooldown hits, in entity-ID order, so the same fight always ends the same way. Gloamlings
// batter House doors (the sleepers inside come out and fight) and the walls in their way.
// Villagers, the Hero, doors and walls are back to full HP at Dawn; a Knocked-out Hero gets up at
// full HP once its time is up, at the village hall's door once one stands. By day or night the
// Hero hits a Den it's ordered to attack, and every Den stings whoever stands next to it.
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import {
  attackersOf,
  batteredBy,
  chebyshev,
  heroFoe,
  inReach,
  isBrokenInOn,
  isEngaged,
  isLivedInHouse,
  isOutInTheOpen,
  stungBy,
  targetTile,
  villagerFoe,
} from '../combat';
import { killVillager } from '../deaths';
import { clearDen } from '../dens';
import { destroyEntity, idsOf } from '../entities';
import { entityDoor, inBounds, tileCenter, tileIndex } from '../grid';
import { recoveryTile } from '../hero';
import { litGrid } from '../lights';
import { mapChanged } from '../mapCache';
import { type CostSearch, findPath } from '../pathfinding';
import type { DeathCause, EntityId, GameState, Tile } from '../state';
import { fullHp, isWall, isWallType } from '../walls';
import { isOnWatch, towerFoe, watchOf } from '../watchtowers';
import { dropWork } from '../workers';
import {
  gloamlingCosts,
  gloamlingGrid,
  isAt,
  rerouteTo,
  stopAtNextTile,
  villagerTile,
} from './movement';

/**
 * Walking costs from a tile for a Gloamling, or with `throughWalls` as if no wall segment stood
 * (`gloamlingCosts`).
 */
type CostsFrom = (tile: Tile, throughWalls?: boolean) => CostSearch;

export function combatSystem(state: GameState, content: Content): void {
  const { villager, gloamling, hero } = state.components;
  const dawn = isDawn(state.tick, content);
  if (dawn) {
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v) v.hp = content.combat.villager.hp;
    }
    for (const b of Object.values(state.components.building)) {
      if (b.hp !== null) b.hp = fullHp(content, b.type);
    }
    mapChanged(state); // broken walls block again
  }
  for (const id of idsOf(hero)) {
    const h = hero[id];
    if (!h) continue;
    const getsUp = h.knockedOutUntil !== null && state.tick >= h.knockedOutUntil;
    if (getsUp) getUp(state, content, id);
    if (getsUp || (dawn && h.knockedOutUntil === null)) h.hp = content.combat.hero.hp;
  }
  const gloamlings = idsOf(gloamling);
  if (gloamlings.length === 0) {
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v) v.fighting = false;
    }
    // By day only the Hero and Dens fight.
    if (idsOf(state.components.den).length > 0) resolveHits(state, content);
    return;
  }

  const lit = litGrid(state, content);
  const costsFrom: CostsFrom = (tile, throughWalls = false) =>
    gloamlingCosts(state, content, tileIndex(state.map, tile.x, tile.y), throughWalls);
  for (const id of gloamlings) pickTarget(state, content, id, lit, costsFrom);
  for (const id of gloamlings) chase(state, content, id);
  engage(state, content);
  resolveHits(state, content);
}

/** Whether `target`'s tile (a House's door) is lit tonight, by `lit` (`litGrid`). */
function inLight(state: GameState, content: Content, lit: Uint8Array, target: EntityId): boolean {
  const t = targetTile(state, content, target);
  return t !== null && lit[tileIndex(state.map, t.x, t.y)] === 1;
}

/**
 * Whether Gloamling `target` is still worth going for: there, not in Light, and a House or wall
 * segment not battered down yet.
 */
function stillTarget(
  state: GameState,
  content: Content,
  lit: Uint8Array,
  target: EntityId,
): boolean {
  if (inLight(state, content, lit, target)) return false;
  const b = state.components.building[target];
  if (b) {
    if (b.hp === null || b.hp <= 0) return false;
    return isWallType(content, b.type) || isLivedInHouse(state, content, target);
  }
  return isOutInTheOpen(state, content, target);
}

/**
 * Gloamling `id` keeps its villager or Hero until it's gone, safe asleep at Home or in Light.
 * Otherwise it goes for the nearest (walking cost) villager out in the open or Hero within its
 * sight and out of Light that it can walk to, ties to the lowest ID; else it keeps the House or
 * wall segment it's going for until that's broken. With nothing yet, it goes for one in sight
 * that only walls shut away from it (it batters its way in: `chase`), then for the nearest
 * lived-in House whose door is dark, walkable to first, then behind walls.
 */
function pickTarget(
  state: GameState,
  content: Content,
  id: EntityId,
  lit: Uint8Array,
  costsFrom: CostsFrom,
): void {
  const g = state.components.gloamling[id];
  const here = villagerTile(state, id);
  if (!g || !here) return;
  if (g.target !== null && !stillTarget(state, content, lit, g.target)) g.target = null;
  if (g.target !== null && !state.components.building[g.target]) return;

  const { villager, hero } = state.components;
  const sight = content.combat.gloamling.sightTiles;
  const inSight = [...idsOf(villager), ...idsOf(hero)]
    .sort((a, b) => a - b)
    .filter((c) => {
      const t = villagerTile(state, c);
      return t !== null && chebyshev(t, here) <= sight && stillTarget(state, content, lit, c);
    });
  const walkerTile = (c: EntityId) => villagerTile(state, c);
  if (inSight.length > 0) {
    const nearest = nearestBy(inSight, costsFrom(here), walkerTile, state);
    if (nearest !== null) {
      g.target = nearest;
      return;
    }
  }
  if (g.target !== null) return; // keeps heading for its House or battering its wall
  const behindWalls =
    inSight.length > 0 ? nearestBy(inSight, costsFrom(here, true), walkerTile, state) : null;
  if (behindWalls !== null) {
    g.target = behindWalls;
    return;
  }
  const houses = idsOf(state.components.building).filter(
    (b) => !isWall(state, content, b) && stillTarget(state, content, lit, b),
  );
  const door = (b: EntityId) => entityDoor(state, content, b);
  g.target =
    nearestBy(houses, costsFrom(here), door, state) ??
    nearestBy(houses, costsFrom(here, true), door, state);
}

/** Of `ids` (ascending), the one whose tile costs least in `costs`, ties to the lowest ID. */
function nearestBy(
  ids: readonly EntityId[],
  costs: CostSearch,
  tileOf: (id: EntityId) => Tile | null,
  state: GameState,
): EntityId | null {
  let best: { id: EntityId; cost: number } | null = null;
  for (const id of ids) {
    const t = tileOf(id);
    if (!t) continue;
    const cost = costs.costTo(tileIndex(state.map, t.x, t.y));
    if (cost !== Number.POSITIVE_INFINITY && (!best || cost < best.cost)) best = { id, cost };
  }
  return best?.id ?? null;
}

/**
 * Walks Gloamling `id` toward its target, following it as it moves: to a villager's or the Hero's
 * tile until it's in reach, to a House's door, where it waits, or next to a wall segment, where
 * it stands. When walls shut its target away, it goes for the first wall segment on its way
 * there as if walls weren't built (`wallInTheWay`). It stops at the next tile when it has
 * nothing to go for, and gives up a target it can't walk to even through walls.
 */
function chase(state: GameState, content: Content, id: EntityId): void {
  const g = state.components.gloamling[id];
  if (!g) return;
  if (g.target === null) {
    stopAtNextTile(state, id);
    return;
  }
  const wall = isWall(state, content, g.target);
  if (isEngaged(state, content, id) || (wall && batteredBy(state, content, id) !== null)) {
    stopAtNextTile(state, id);
    return;
  }
  const goals = approach(state, content, g.target);
  if (goals.length === 0) {
    g.target = null;
    return;
  }
  const goalIndices = goals.map((t) => tileIndex(state.map, t.x, t.y));
  const path = state.components.path[id];
  if (path && goalIndices.includes(path.tiles[path.tiles.length - 1] as number)) return;
  if (!path && goals.some((t) => isAt(state, id, t))) return;
  if (rerouteTo(state, content, id, goals)) return;
  g.target = wall ? null : wallInTheWay(state, content, id, goals);
  if (g.target !== null && !rerouteTo(state, content, id, approach(state, content, g.target))) {
    g.target = null;
  }
}

/**
 * The tiles a Gloamling walks to for `target`: a villager's or the Hero's tile, a House's door,
 * or those round a wall segment. None if it's gone.
 */
function approach(state: GameState, content: Content, target: EntityId): Tile[] {
  const t = targetTile(state, content, target);
  if (!t) return [];
  if (!isWall(state, content, target)) return [t];
  const round: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = t.x + dx;
      const y = t.y + dy;
      if (inBounds(state.map, x, y)) round.push({ x, y });
    }
  }
  return round;
}

/**
 * The first standing wall segment (palisade or Gate) on Gloamling `id`'s way to the nearest of
 * `goals`, pathing as if no wall stood. Null when there's no way even so, or no wall on it.
 */
function wallInTheWay(
  state: GameState,
  content: Content,
  id: EntityId,
  goals: readonly Tile[],
): EntityId | null {
  const { map } = state;
  const here = villagerTile(state, id);
  if (!here) return null;
  const tiles = findPath(
    gloamlingGrid(state, content, true),
    tileIndex(map, here.x, here.y),
    goals.map((t) => tileIndex(map, t.x, t.y)),
  );
  if (!tiles) return null;
  const walls = new Map<number, EntityId>();
  for (const b of idsOf(state.components.building)) {
    const t = state.components.tile[b];
    const hp = state.components.building[b]?.hp ?? 0;
    if (t && hp > 0 && isWall(state, content, b)) walls.set(tileIndex(map, t.x, t.y), b);
  }
  for (const t of tiles) {
    const wall = walls.get(t);
    if (wall !== undefined) return wall;
  }
  return null;
}

/**
 * A villager a Gloamling reaches starts fighting: it drops its work (the unassign rule, keeping
 * its Job) and stands. It stops once none is left in reach, and its routine carries on.
 */
function engage(state: GameState, content: Content): void {
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v) continue;
    const attacked = attackersOf(state, content, id).length > 0;
    if (attacked && !v.fighting) {
      dropWork(state, content, id);
      v.fighting = true;
    } else if (!attacked) {
      v.fighting = false;
    }
  }
}

/**
 * Everyone in reach of its foe and off cooldown hits once, in entity-ID order: a Gloamling its
 * target, a villager fighting, in the militia or broken in on its foe (`villagerFoe`), a Watchman in its tower
 * the tower's foe (`towerFoe`, timed by the Watchman's `readyAt`), the Hero its foe (`heroFoe`),
 * a Den everyone it stings (`stungBy`). Whoever drops to 0 HP is gone (or Knocked out) before its
 * turn comes.
 */
function resolveHits(state: GameState, content: Content): void {
  const { villager, gloamling, hero, den } = state.components;
  const fighters = [
    ...idsOf(villager).filter(
      (id) =>
        villager[id]?.fighting ||
        villager[id]?.militia ||
        isOnWatch(state, content, id) ||
        isBrokenInOn(state, content, id),
    ),
    ...idsOf(hero),
    ...idsOf(gloamling),
    ...idsOf(den),
  ].sort((a, b) => a - b);
  for (const id of fighters) {
    const d = den[id];
    if (d) {
      if (state.tick < d.readyAt) continue;
      const stung = stungBy(state, content, id);
      if (stung.length === 0) continue;
      d.readyAt = state.tick + content.combat.den.cooldownTicks;
      for (const victim of stung) hurt(state, content, victim, content.combat.den.damage, 'den');
      continue;
    }
    const h = hero[id];
    if (h) {
      if (state.tick < h.readyAt) continue;
      const foe = heroFoe(state, content, id);
      if (foe === null) continue;
      h.readyAt = state.tick + content.combat.hero.cooldownTicks;
      hurt(state, content, foe, content.combat.hero.damage);
      continue;
    }
    const g = gloamling[id];
    if (g) {
      const { damage, cooldownTicks, reachTiles } = content.combat.gloamling;
      if (g.target === null || state.tick < g.readyAt) continue;
      const battered = batteredBy(state, content, id);
      if (battered !== null) {
        g.readyAt = state.tick + cooldownTicks;
        batter(state, id, battered, damage);
        continue;
      }
      if (state.components.building[g.target] || !inReach(state, id, g.target, reachTiles)) {
        continue;
      }
      g.readyAt = state.tick + cooldownTicks;
      hurt(state, content, g.target, damage);
      continue;
    }
    const v = villager[id];
    if (!v || state.tick < v.readyAt) continue;
    const watch = watchOf(state, content, id);
    const shot = watch === null ? null : towerFoe(state, content, id);
    if (watch && shot !== null) {
      v.readyAt = state.tick + watch.cooldownTicks;
      hurt(state, content, shot, watch.damage);
      continue;
    }
    const foe = villagerFoe(state, content, id);
    if (foe === null || !inReach(state, id, foe, content.combat.villager.reachTiles)) continue;
    v.readyAt = state.tick + content.combat.villager.cooldownTicks;
    hurt(state, content, foe, content.combat.villager.damage);
  }
}

/**
 * Takes `damage` off `id`: a villager at 0 HP dies of `cause`, the Hero is Knocked out, a
 * Gloamling is gone, a Den is cleared.
 */
function hurt(
  state: GameState,
  content: Content,
  id: EntityId,
  damage: number,
  cause: DeathCause = 'gloamling',
): void {
  const h = state.components.hero[id];
  if (h) {
    h.hp = Math.max(0, h.hp - damage);
    if (h.hp === 0) knockOut(state, content, id);
    return;
  }
  const v = state.components.villager[id];
  if (v) {
    v.hp -= damage;
    if (v.hp <= 0) killVillager(state, content, id, cause);
    return;
  }
  const g = state.components.gloamling[id];
  if (g) {
    g.hp -= damage;
    if (g.hp <= 0) destroyEntity(state, id);
    return;
  }
  const d = state.components.den[id];
  if (d) {
    d.hp = Math.max(0, d.hp - damage);
    if (d.hp === 0) clearDen(state, content, id);
  }
}

/**
 * Gloamling `id` hits `building` (a House's door or a wall segment) for `damage`. At 0 HP it's
 * broken until Dawn: a House's residents asleep inside are out in the open (`isBrokenInOn`) and
 * fight, a wall stops blocking, and the Gloamling picks a new target.
 */
function batter(state: GameState, id: EntityId, building: EntityId, damage: number): void {
  const b = state.components.building[building];
  const g = state.components.gloamling[id];
  if (!b || b.hp === null || !g) return;
  b.hp = Math.max(0, b.hp - damage);
  if (b.hp === 0) {
    g.target = null;
    mapChanged(state); // a broken wall stops blocking
  }
}

/**
 * The Knocked-out Hero gets up: at the village hall's door once one stands (`recoveryTile`), else
 * where it fell.
 */
function getUp(state: GameState, content: Content, id: EntityId): void {
  const h = state.components.hero[id];
  if (!h) return;
  h.knockedOutUntil = null;
  const at = recoveryTile(state, content);
  if (!at) return;
  state.components.position[id] = tileCenter(at);
  delete state.components.path[id];
}

/**
 * The Hero falls where it stands for `knockoutTicks`: its order is dropped (goods stay in its
 * hands) and its walk ends at the next tile.
 */
function knockOut(state: GameState, content: Content, id: EntityId): void {
  const h = state.components.hero[id];
  if (!h) return;
  h.knockedOutUntil = state.tick + content.combat.hero.knockoutTicks;
  h.order = null;
  stopAtNextTile(state, id);
}
