// Player commands: the only way the outside world changes the sim.
import type { BuildingId, Content, ResourceId } from '@candlemarch/content';
import { createEntity, destroyEntity } from './entities';
import { canPlaceBuilding } from './grid';
import { type HeroOrder, orderHero } from './hero';
import { layPath, removePath } from './roads';
import type { EntityId, GameState, StockpilePriority, Tile } from './state';
import {
  isStockpileGood,
  placeStockpile,
  removeStockpile,
  STOCKPILE_PRIORITIES,
} from './stockpiles';

export type Command =
  | { type: 'placeBuilding'; building: BuildingId; x: number; y: number }
  | { type: 'cancelConstruction'; siteId: EntityId }
  | { type: 'layPath'; from: Tile; to: Tile }
  | { type: 'removePath'; from: Tile; to: Tile }
  | { type: 'placeStockpile'; x: number; y: number; w: number; h: number }
  | { type: 'removeStockpile'; id: EntityId }
  | { type: 'setStockpilePriority'; id: EntityId; priority: StockpilePriority }
  | { type: 'setStockpileAccepts'; id: EntityId; resource: ResourceId; accepts: boolean }
  | ({ type: 'orderHero' } & HeroOrder);

/** Applies one command. Commands that aren't valid right now are ignored. */
export function applyCommand(state: GameState, command: Command, content: Content): void {
  switch (command.type) {
    case 'placeBuilding': {
      const { building, x, y } = command;
      if (!canPlaceBuilding(state, content, building, x, y)) return;
      const id = createEntity(state);
      state.components.tile[id] = { x, y };
      state.components.site[id] = { type: building, delivered: {}, buildProgress: 0 };
      return;
    }
    case 'cancelConstruction': {
      // Delivered materials are lost: there is no storage to return them to yet.
      if (state.components.site[command.siteId]) destroyEntity(state, command.siteId);
      return;
    }
    case 'layPath': {
      layPath(state, content, command.from, command.to);
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
  }
}
