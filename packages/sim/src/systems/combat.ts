// Night combat, resolved on its own. Each tick every Gloamling picks what to go for and walks
// there; a villager a Gloamling reaches drops its work and hits back; then everyone in reach and
// off cooldown hits, in entity-ID order, so the same fight always ends the same way. Villagers are
// back to full HP at Dawn, and so is the Hero; a Knocked-out Hero gets up at full HP once its time
// is up.
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import {
  attackersOf,
  chebyshev,
  heroFoe,
  inReach,
  isEngaged,
  isLivedInHouse,
  isOutInTheOpen,
  targetTile,
  villagerFoe,
} from '../combat';
import { killVillager } from '../deaths';
import { destroyEntity, idsOf } from '../entities';
import { entityDoor, tileIndex } from '../grid';
import { litGrid } from '../lights';
import { type Grid, travelCosts } from '../pathfinding';
import type { EntityId, GameState, Tile } from '../state';
import { dropWork } from '../workers';
import { gloamlingGrid, isAt, rerouteTo, stopAtNextTile, villagerTile } from './movement';

/** Walking costs from a tile to every tile, worked out at most once a tick per tile. */
type CostsFrom = (tile: Tile) => Float64Array;

export function combatSystem(state: GameState, content: Content): void {
  const { villager, gloamling, hero } = state.components;
  const dawn = isDawn(state.tick, content);
  if (dawn) {
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v) v.hp = content.combat.villager.hp;
    }
  }
  for (const id of idsOf(hero)) {
    const h = hero[id];
    if (!h) continue;
    const getsUp = h.knockedOutUntil !== null && state.tick >= h.knockedOutUntil;
    if (getsUp) h.knockedOutUntil = null;
    if (getsUp || (dawn && h.knockedOutUntil === null)) h.hp = content.combat.hero.hp;
  }
  const gloamlings = idsOf(gloamling);
  if (gloamlings.length === 0) {
    for (const id of idsOf(villager)) {
      const v = villager[id];
      if (v) v.fighting = false;
    }
    return;
  }

  let grid: Grid | null = null;
  const lit = litGrid(state, content);
  const cache = new Map<number, Float64Array>();
  const costsFrom: CostsFrom = (tile) => {
    const i = tileIndex(state.map, tile.x, tile.y);
    let costs = cache.get(i);
    if (!costs) {
      grid ??= gloamlingGrid(state, content);
      costs = travelCosts(grid, i);
      cache.set(i, costs);
    }
    return costs;
  };
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

/** Whether Gloamling `target` is still worth going for: there, and not in Light. */
function stillTarget(
  state: GameState,
  content: Content,
  lit: Uint8Array,
  target: EntityId,
): boolean {
  if (inLight(state, content, lit, target)) return false;
  if (state.components.building[target]) return isLivedInHouse(state, content, target);
  return isOutInTheOpen(state, content, target);
}

/**
 * Gloamling `id` keeps its villager or Hero until it's gone, safe asleep at Home or in Light.
 * Otherwise it goes for the nearest (walking cost) villager out in the open or Hero within its
 * sight and out of Light, ties to the lowest ID; with none in sight, for the nearest lived-in
 * House whose door is dark and it can walk to.
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
  if (inSight.length > 0) {
    const nearest = nearestBy(inSight, costsFrom(here), (c) => villagerTile(state, c), state);
    if (nearest !== null) {
      g.target = nearest;
      return;
    }
  }
  if (g.target !== null) return; // keeps heading for its House
  const houses = idsOf(state.components.building).filter((b) =>
    stillTarget(state, content, lit, b),
  );
  g.target = nearestBy(houses, costsFrom(here), (b) => entityDoor(state, content, b), state);
}

/** Of `ids` (ascending), the one whose tile costs least in `costs`, ties to the lowest ID. */
function nearestBy(
  ids: readonly EntityId[],
  costs: Float64Array,
  tileOf: (id: EntityId) => Tile | null,
  state: GameState,
): EntityId | null {
  let best: { id: EntityId; cost: number } | null = null;
  for (const id of ids) {
    const t = tileOf(id);
    if (!t) continue;
    const cost = costs[tileIndex(state.map, t.x, t.y)] ?? Number.POSITIVE_INFINITY;
    if (cost !== Number.POSITIVE_INFINITY && (!best || cost < best.cost)) best = { id, cost };
  }
  return best?.id ?? null;
}

/**
 * Walks Gloamling `id` toward its target, following it as it moves: to a villager's or the Hero's
 * tile until it's in reach, or to a House's door, where it waits. It stops at the next tile when
 * it has nothing to go for, and gives up a target it can't walk to.
 */
function chase(state: GameState, content: Content, id: EntityId): void {
  const g = state.components.gloamling[id];
  if (!g) return;
  if (g.target === null) {
    stopAtNextTile(state, id);
    return;
  }
  if (isEngaged(state, content, id)) {
    stopAtNextTile(state, id);
    return;
  }
  const goal = targetTile(state, content, g.target);
  if (!goal) {
    g.target = null;
    return;
  }
  const path = state.components.path[id];
  if (path && path.tiles[path.tiles.length - 1] === tileIndex(state.map, goal.x, goal.y)) return;
  if (isAt(state, id, goal)) return;
  if (!rerouteTo(state, content, id, [goal])) g.target = null;
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
 * target, a villager fighting or in the militia its foe (`villagerFoe`), the Hero its foe
 * (`heroFoe`). Whoever drops to 0 HP is gone (or Knocked out) before its turn comes.
 */
function resolveHits(state: GameState, content: Content): void {
  const { villager, gloamling, hero } = state.components;
  const fighters = [
    ...idsOf(villager).filter((id) => villager[id]?.fighting || villager[id]?.militia),
    ...idsOf(hero),
    ...idsOf(gloamling),
  ].sort((a, b) => a - b);
  for (const id of fighters) {
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
      if (state.components.building[g.target] || !inReach(state, id, g.target, reachTiles)) {
        continue;
      }
      g.readyAt = state.tick + cooldownTicks;
      hurt(state, content, g.target, damage);
      continue;
    }
    const v = villager[id];
    if (!(v?.fighting || v?.militia) || state.tick < v.readyAt) continue;
    const foe = villagerFoe(state, content, id);
    if (foe === null || !inReach(state, id, foe, content.combat.villager.reachTiles)) continue;
    v.readyAt = state.tick + content.combat.villager.cooldownTicks;
    hurt(state, content, foe, content.combat.villager.damage);
  }
}

/**
 * Takes `damage` off `id`: a villager at 0 HP dies of it, the Hero is Knocked out, a Gloamling is
 * gone.
 */
function hurt(state: GameState, content: Content, id: EntityId, damage: number): void {
  const h = state.components.hero[id];
  if (h) {
    h.hp = Math.max(0, h.hp - damage);
    if (h.hp === 0) knockOut(state, content, id);
    return;
  }
  const v = state.components.villager[id];
  if (v) {
    v.hp -= damage;
    if (v.hp <= 0) killVillager(state, content, id, 'gloamling');
    return;
  }
  const g = state.components.gloamling[id];
  if (g) {
    g.hp -= damage;
    if (g.hp <= 0) destroyEntity(state, id);
  }
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
