// The hero: one per game, not a villager, acts only on the player's orders. It walks, chops trees
// and carries goods by hand to kickstart the village (spec, logistics stage 1).
import type { Content, ResourceId } from '@candlemarch/content';
import { idsOf } from './entities';
import { isForagePatch } from './forage';
import {
  blockedGrid,
  entityDoor,
  footprint,
  isWalkableTerrain,
  standingTiles,
  stockpileTileIndices,
  tileAt,
  tileIndex,
} from './grid';
import { fellTree } from './huntingGrounds';
import {
  freeRoomOnTile,
  haulsIncoming,
  nearestTile,
  reserved,
  reservedOnTile,
} from './logistics/jobDispatch';
import { inputRoom } from './logistics/supplyDemand';
import type { EntityId, GameState, HeroComponent, HeroTask, Tile } from './state';
import { addToTile, amountOnTile, stockpileTakes, takeFromTile } from './stockpiles';
import { isAt, rerouteTo, stopAtNextTile, villagerTile } from './systems/movement';

/** An order for the hero, given by right-clicking. */
export type HeroOrder =
  | { order: 'move'; x: number; y: number }
  | { order: 'gather'; tree: EntityId }
  | { order: 'deliver'; target: EntityId }
  | { order: 'pickup'; source: EntityId };

/** The hero's entity ID, or null if this game has none. */
export function heroOf(state: GameState): EntityId | null {
  return idsOf(state.components.hero)[0] ?? null;
}

/** Units of `resource` the hero can still pick up: 0 if its hands hold something else. */
function roomFor(content: Content, hero: HeroComponent, resource: ResourceId): number {
  const capacity = content.heroes[hero.type].carryCapacity;
  if (!hero.carrying) return capacity;
  return hero.carrying.resource === resource ? capacity - hero.carrying.amount : 0;
}

/** Walkable tiles next to tree `tree`, where the hero can chop it from. */
function treeStandingTiles(state: GameState, content: Content, tree: EntityId): Tile[] {
  const at = state.components.tile[tree];
  return at ? standingTiles(state, blockedGrid(state, content), at) : [];
}

/**
 * Gives the hero a new order, replacing the current one. An order the hero can't carry out, such
 * as a tile it can't reach or a tree when its hands are full, is ignored and the current order
 * stands.
 * - move: walk to the tile by the quickest route (roads included).
 * - gather: walk next to the tree and chop it until it's gone or the hero's hands are full.
 * - deliver: carry what's in hand to a site that still needs it or a workshop whose input buffer
 *   has room for it, once carriers' hauls are counted, or to a stockpile with room that takes it
 *   (never Food). The hero promises a site or workshop what it will bring, and carriers count that
 *   as incoming.
 * - pickup: take goods no carrier has claimed from a building's output buffer or a stockpile,
 *   as many as the hero's hands still hold.
 */
export function orderHero(state: GameState, content: Content, order: HeroOrder): void {
  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  if (id === null || !hero) return;
  switch (order.order) {
    case 'move': {
      if (rerouteTo(state, content, id, [{ x: order.x, y: order.y }])) hero.order = null;
      return;
    }
    case 'gather': {
      const tree = state.components.mapObject[order.tree];
      // Trees only: forage patches are the forager's.
      if (!tree || tree.amount <= 0 || isForagePatch(state, content, order.tree)) return;
      const def = content.mapObjects[tree.type];
      if (roomFor(content, hero, def.resource) <= 0) return;
      if (!rerouteTo(state, content, id, treeStandingTiles(state, content, order.tree))) return;
      hero.order = { kind: 'gather', tree: order.tree, ticksLeft: def.gatherTicks };
      return;
    }
    case 'deliver': {
      const task = deliverTask(state, content, hero, order.target);
      if (!task || !rerouteTo(state, content, id, [tileAt(state.map, task.tile)])) return;
      hero.order = task;
      return;
    }
    case 'pickup': {
      const task = pickupTask(state, content, hero, order.source);
      if (!task || !rerouteTo(state, content, id, [tileAt(state.map, task.tile)])) return;
      hero.order = task;
      return;
    }
  }
}

type PickupTask = Extract<HeroTask, { kind: 'pickup' }>;

/**
 * A pickup from `source`: its door if it's a building (its first output with unclaimed goods the
 * hero has room for), or the stockpile tile nearest the hero with unclaimed goods it has room for
 * (resources in content order). Null if there's nothing to take.
 */
function pickupTask(
  state: GameState,
  content: Content,
  hero: HeroComponent,
  source: EntityId,
): PickupTask | null {
  const building = state.components.building[source];
  if (building) {
    const door = entityDoor(state, content, source);
    const slot = content.buildings[building.type].outputBuffer?.find(
      ({ resource }) =>
        unclaimedAt(state, source, resource, null) > 0 && roomFor(content, hero, resource) > 0,
    );
    if (!slot || !door) return null;
    const tile = tileIndex(state.map, door.x, door.y);
    return { kind: 'pickup', source, resource: slot.resource, tile };
  }
  for (const resource of Object.keys(content.resources) as ResourceId[]) {
    if (roomFor(content, hero, resource) <= 0) continue;
    const tile = pileTileWithGoods(state, source, resource);
    if (tile !== null) return { kind: 'pickup', source, resource, tile };
  }
  return null;
}

/**
 * Units of `resource` at `source` no carrier has claimed: in a building's output buffer, or on
 * stockpile tile `tile`.
 */
function unclaimedAt(
  state: GameState,
  source: EntityId,
  resource: ResourceId,
  tile: number | null,
): number {
  const { hauls } = state.logistics;
  const building = state.components.building[source];
  if (building) return (building.stock[resource] ?? 0) - reserved(hauls, source, resource);
  const pile = state.components.stockpile[source];
  if (!pile || tile === null) return 0;
  return amountOnTile(pile, tile, resource) - reservedOnTile(hauls, tile);
}

/** The tile of stockpile `pile` nearest the hero with unclaimed `resource`, or null. */
function pileTileWithGoods(state: GameState, pile: EntityId, resource: ResourceId): number | null {
  const id = heroOf(state);
  const here = id === null ? null : villagerTile(state, id);
  if (!here) return null;
  const found = nearestTile(
    state.map.width,
    stockpileTileIndices(state, pile),
    tileIndex(state.map, here.x, here.y),
    (i) => unclaimedAt(state, pile, resource, i),
  );
  return found?.tile ?? null;
}

type DeliverTask = Extract<HeroTask, { kind: 'deliver' }>;

/**
 * Units of `resource` a site still lacks or a workshop's input buffer has room for, not counting
 * anything on its way. 0 for anything else.
 */
function wanted(
  state: GameState,
  content: Content,
  target: EntityId,
  resource: ResourceId,
): number {
  const site = state.components.site[target];
  if (!site) return inputRoom(state, content, target, resource);
  const cost = content.buildings[site.type].construction?.cost.find((c) => c.resource === resource);
  return (cost?.amount ?? 0) - (site.delivered[resource] ?? 0);
}

/** A delivery of what the hero holds to `target`, or null if `target` doesn't want it. */
function deliverTask(
  state: GameState,
  content: Content,
  hero: HeroComponent,
  target: EntityId,
): DeliverTask | null {
  const goods = hero.carrying;
  if (!goods) return null;
  const { resource } = goods;
  if (state.components.stockpile[target]) {
    const tile = pileTileWithRoom(state, content, target, resource);
    return tile === null ? null : { kind: 'deliver', target, resource, tile, amount: goods.amount };
  }
  const door = entityDoor(state, content, target);
  if (!door) return null;
  const amount = Math.min(
    goods.amount,
    wanted(state, content, target, resource) -
      haulsIncoming(state.logistics.hauls, target, resource),
  );
  if (amount <= 0) return null;
  const tile = tileIndex(state.map, door.x, door.y);
  return { kind: 'deliver', target, resource, tile, amount };
}

/** The tree, building, site or stockpile covering `tile`, if any. */
function thingAt(state: GameState, content: Content, tile: Tile): EntityId | null {
  const { mapObject, building, site, stockpile } = state.components;
  const same = (t: Tile) => t.x === tile.x && t.y === tile.y;
  for (const id of idsOf(state.components.tile)) {
    const origin = state.components.tile[id] as Tile;
    if (mapObject[id] && same(origin)) return id;
    const placed = building[id] ?? site[id];
    if (placed && footprint(content.buildings[placed.type], origin, placed.rotation).some(same)) {
      return id;
    }
    const pile = stockpile[id];
    if (pile && stockpileTileIndices(state, id).includes(tileIndex(state.map, tile.x, tile.y))) {
      return id;
    }
  }
  return null;
}

/**
 * What right-clicking `tile` orders the hero to do: chop a tree; deliver what it holds to a site,
 * workshop or stockpile that wants it, or else pick up from a building or stockpile with goods;
 * walk onto open ground. Null when there's something on the tile but nothing to do with it. The
 * client uses this so the rules stay in the sim; the command is still checked when it's applied.
 */
export function heroOrderAt(state: GameState, content: Content, tile: Tile): HeroOrder | null {
  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  if (!hero) return null;
  const thing = thingAt(state, content, tile);
  if (thing === null) {
    return isWalkableTerrain(state, content, tile) ? { order: 'move', x: tile.x, y: tile.y } : null;
  }
  const tree = state.components.mapObject[thing];
  if (tree) {
    const resource = content.mapObjects[tree.type].resource;
    const canChop = !isForagePatch(state, content, thing) && roomFor(content, hero, resource) > 0;
    return canChop ? { order: 'gather', tree: thing } : null;
  }
  if (deliverTask(state, content, hero, thing)) return { order: 'deliver', target: thing };
  if (pickupTask(state, content, hero, thing)) return { order: 'pickup', source: thing };
  return null;
}

/** Whether tile `a` touches tile `b`, diagonals included. */
function touches(a: Tile, b: Tile): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

/** Works the hero's order for one tick, once it has walked where the order needs it. */
/** Whether the tree, site, stockpile or building an order is for still exists. */
function orderTargetExists(state: GameState, order: HeroTask): boolean {
  const { mapObject, site, stockpile, building } = state.components;
  switch (order.kind) {
    case 'gather':
      return (mapObject[order.tree]?.amount ?? 0) > 0;
    case 'deliver':
      return (
        site[order.target] !== undefined ||
        building[order.target] !== undefined ||
        stockpile[order.target] !== undefined
      );
    case 'pickup':
      return building[order.source] !== undefined || stockpile[order.source] !== undefined;
  }
}

export function heroSystem(state: GameState, content: Content): void {
  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  if (id === null || !hero?.order) return;
  const order = hero.order;
  // Checked even while walking: the order ends as soon as what it's for is gone (tree felled,
  // site cancelled or built, stockpile removed), and the hero stops at the next tile.
  if (!orderTargetExists(state, order)) {
    hero.order = null;
    stopAtNextTile(state, id);
    return;
  }
  if (state.components.path[id]) return;

  switch (order.kind) {
    case 'gather': {
      const tree = state.components.mapObject[order.tree];
      const at = state.components.tile[order.tree];
      const here = villagerTile(state, id);
      if (!tree || !at || !here) return;
      if (!touches(here, at)) {
        // Knocked off its walk: try again, or give up if the tree can't be reached any more.
        if (!rerouteTo(state, content, id, treeStandingTiles(state, content, order.tree))) {
          hero.order = null;
        }
        return;
      }
      order.ticksLeft -= 1;
      if (order.ticksLeft > 0) return;
      // The same gather rules as a woodcutter, but the hero keeps chopping while it has room.
      const def = content.mapObjects[tree.type];
      const amount = Math.min(
        def.yieldPerGather,
        tree.amount,
        roomFor(content, hero, def.resource),
      );
      if (amount <= 0) {
        hero.order = null; // hands full, or holding something else
        return;
      }
      tree.amount -= amount;
      hero.carrying = { resource: def.resource, amount: (hero.carrying?.amount ?? 0) + amount };
      if (tree.amount === 0) fellTree(state, content, order.tree);
      if (tree.amount === 0 || roomFor(content, hero, def.resource) <= 0) hero.order = null;
      else order.ticksLeft = def.gatherTicks;
      return;
    }
    case 'deliver': {
      const site = state.components.site[order.target];
      const workshop = state.components.building[order.target];
      const pile = state.components.stockpile[order.target];
      if (hero.carrying?.resource !== order.resource) {
        hero.order = null;
        return;
      }
      const at = tileAt(state.map, order.tile);
      if (!isAt(state, id, at)) {
        if (!rerouteTo(state, content, id, [at])) hero.order = null;
        return;
      }
      // A site's or workshop's promised amount goes in whole, even if the workshop has paused since:
      // its room was held.
      const into = site?.delivered ?? workshop?.input;
      if (into) {
        into[order.resource] = (into[order.resource] ?? 0) + order.amount;
        takeFromHands(hero, order.amount);
        hero.order = null;
        return;
      }
      // A stockpile: put down what fits here, then carry the rest to the next tile with room.
      const room = freeRoomOnTile(state, content, order.target, order.tile, order.resource);
      const amount = Math.min(hero.carrying.amount, room);
      if (pile && amount > 0) addToTile(pile, order.tile, { resource: order.resource, amount });
      takeFromHands(hero, amount);
      const next = hero.carrying
        ? pileTileWithRoom(state, content, order.target, order.resource)
        : null;
      if (next === null || !rerouteTo(state, content, id, [tileAt(state.map, next)])) {
        hero.order = null;
        return;
      }
      order.tile = next;
      return;
    }
    case 'pickup': {
      const building = state.components.building[order.source];
      const pile = state.components.stockpile[order.source];
      const at = tileAt(state.map, order.tile);
      if (!isAt(state, id, at)) {
        if (!rerouteTo(state, content, id, [at])) hero.order = null;
        return;
      }
      const amount = Math.min(
        roomFor(content, hero, order.resource),
        unclaimedAt(state, order.source, order.resource, order.tile),
      );
      if (amount > 0) {
        if (building)
          building.stock[order.resource] = (building.stock[order.resource] ?? 0) - amount;
        else if (pile) takeFromTile(pile, order.tile, order.resource, amount);
        hero.carrying = {
          resource: order.resource,
          amount: (hero.carrying?.amount ?? 0) + amount,
        };
      }
      hero.order = null;
      return;
    }
  }
}

/**
 * The tile of stockpile `pile` nearest the hero with room for `resource` once carriers' promised
 * deliveries are counted, ties to the lowest tile index; null if none or the pile doesn't take it.
 */
function pileTileWithRoom(
  state: GameState,
  content: Content,
  pile: EntityId,
  resource: ResourceId,
): number | null {
  const id = heroOf(state);
  const here = id === null ? null : villagerTile(state, id);
  const stockpile = state.components.stockpile[pile];
  if (!here || !stockpile || !stockpileTakes(content, stockpile, resource)) return null;
  const found = nearestTile(
    state.map.width,
    stockpileTileIndices(state, pile),
    tileIndex(state.map, here.x, here.y),
    (i) => freeRoomOnTile(state, content, pile, i, resource),
  );
  return found?.tile ?? null;
}

/** Removes `amount` from the hero's hands, emptying them at 0. */
function takeFromHands(hero: HeroComponent, amount: number): void {
  if (!hero.carrying) return;
  const left = hero.carrying.amount - amount;
  hero.carrying = left > 0 ? { resource: hero.carrying.resource, amount: left } : null;
}
