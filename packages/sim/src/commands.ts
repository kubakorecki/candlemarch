// Player commands: the only way the outside world changes the sim.
import type { BuildingId, Content, ResourceId } from '@candlemarch/content';
import { isMonsterRate } from './dens';
import { createEntity, destroyEntity } from './entities';
import { setFog } from './fog';
import { clearGrowth } from './forest';
import { buildingLayout, canPlaceBuilding } from './grid';
import { layGroundwork } from './groundwork';
import { type HeroOrder, orderHero } from './hero';
import { ringBell } from './militia';
import { layPath, removePath } from './roads';
import {
  type EntityId,
  type GameState,
  isRotation,
  type Rotation,
  type StockpilePriority,
  type Tile,
} from './state';
import {
  isStockpileGood,
  placeStockpile,
  removeStockpile,
  STOCKPILE_PRIORITIES,
} from './stockpiles';
import { layWall } from './walls';
import { reassignWorker, releaseWorkers, setWorkerLimit, unassignWorker } from './workers';

export type Command =
  | {
      type: 'placeBuilding';
      building: BuildingId;
      x: number;
      y: number;
      /** Quarter turns clockwise from the content layout; 0 when omitted. */
      rotation?: Rotation;
    }
  | { type: 'cancelConstruction'; siteId: EntityId }
  /** Removes a built building at once. Its workers become Carriers; its goods are lost. */
  | { type: 'demolishBuilding'; id: EntityId }
  | { type: 'layPath'; from: Tile; to: Tile }
  | { type: 'removePath'; from: Tile; to: Tile }
  /** Lays wall segments (`palisade` or `gate`) along the L from `from` to `to`, like a path. */
  | { type: 'layWall'; building: BuildingId; from: Tile; to: Tile }
  /** Lays groundwork (a Drain or a Pass road) along the L from `from` to `to`. */
  | { type: 'layGroundwork'; building: BuildingId; from: Tile; to: Tile }
  | { type: 'placeStockpile'; x: number; y: number; w: number; h: number }
  | { type: 'removeStockpile'; id: EntityId }
  | { type: 'setStockpilePriority'; id: EntityId; priority: StockpilePriority }
  | { type: 'setStockpileAccepts'; id: EntityId; resource: ResourceId; accepts: boolean }
  | ({ type: 'orderHero' } & HeroOrder)
  | { type: 'unassignWorker'; villager: EntityId }
  | { type: 'reassignWorker'; villager: EntityId; workplace: EntityId }
  | { type: 'setWorkerLimit'; building: EntityId; limit: number }
  /** Rings the Militia bell: calls the village to arms, or stands it down if it's ringing. */
  | { type: 'ringBell' }
  /** Dev: set the Monster rate (0–100). 0 turns nights off; Gloamlings out vanish at once. */
  | { type: 'setMonsterRate'; rate: number }
  /** Dev: turn Fog on or off. What's Revealed is kept either way. */
  | { type: 'setFog'; on: boolean };

/** Applies one command. Commands that aren't valid right now are ignored. */
export function applyCommand(state: GameState, command: Command, content: Content): void {
  switch (command.type) {
    case 'placeBuilding': {
      const { building, x, y, rotation = 0 } = command;
      if (!isRotation(rotation) || !canPlaceBuilding(state, content, building, x, y, rotation)) {
        return;
      }
      const layout = buildingLayout(content.buildings[building], { x, y }, rotation);
      clearGrowth(state, content, [...layout.tiles, layout.door]);
      const id = createEntity(state);
      state.components.tile[id] = { x, y };
      state.components.site[id] = { type: building, rotation, delivered: {}, buildProgress: 0 };
      return;
    }
    case 'cancelConstruction': {
      // Delivered materials are lost: there is no storage to return them to yet.
      if (state.components.site[command.siteId]) destroyEntity(state, command.siteId);
      return;
    }
    case 'demolishBuilding': {
      // Its goods and building materials are lost, like a cancelled site's. Its residents, hauls
      // to or from it, the hero's order for it and Gloamlings going for it let go of it by
      // themselves.
      if (!state.components.building[command.id]) return;
      releaseWorkers(state, content, command.id);
      destroyEntity(state, command.id);
      return;
    }
    case 'layPath': {
      layPath(state, content, command.from, command.to);
      return;
    }
    case 'layGroundwork': {
      layGroundwork(state, content, command.building, command.from, command.to);
      return;
    }
    case 'layWall': {
      layWall(state, content, command.building, command.from, command.to);
      return;
    }
    case 'removePath': {
      removePath(state, command.from, command.to);
      return;
    }
    case 'placeStockpile': {
      const { x, y, w, h } = command;
      placeStockpile(state, content, x, y, w, h);
      return;
    }
    case 'removeStockpile': {
      removeStockpile(state, command.id);
      return;
    }
    case 'setStockpilePriority': {
      const pile = state.components.stockpile[command.id];
      if (pile && STOCKPILE_PRIORITIES.includes(command.priority)) pile.priority = command.priority;
      return;
    }
    case 'setStockpileAccepts': {
      const pile = state.components.stockpile[command.id];
      // Food never goes to a Stockpile, so there's nothing to accept or refuse.
      if (!pile || !isStockpileGood(content, command.resource)) return;
      const others = pile.refuses.filter((r) => r !== command.resource);
      // Kept in content order, so the same choices always give the same state.
      const refused = command.accepts ? others : [...others, command.resource];
      const order = Object.keys(content.resources);
      pile.refuses = refused.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return;
    }
    case 'orderHero': {
      const { type: _, ...order } = command;
      orderHero(state, content, order);
      return;
    }
    case 'unassignWorker': {
      unassignWorker(state, content, command.villager);
      return;
    }
    case 'reassignWorker': {
      reassignWorker(state, content, command.villager, command.workplace);
      return;
    }
    case 'setWorkerLimit': {
      setWorkerLimit(state, content, command.building, command.limit);
      return;
    }
    case 'ringBell': {
      ringBell(state, content);
      return;
    }
    case 'setMonsterRate': {
      if (isMonsterRate(command.rate)) state.monsterRate = command.rate;
      return;
    }
    case 'setFog': {
      if (typeof command.on === 'boolean') setFog(state, command.on);
      return;
    }
  }
}
