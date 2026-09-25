// Player commands: the only way the outside world changes the sim.
import type { BuildingId, Content } from '@candlemarch/content';
import { createEntity, destroyEntity } from './entities';
import { canPlaceBuilding } from './grid';
import { layPath, removePath } from './roads';
import type { EntityId, GameState, Tile } from './state';

export type Command =
  | { type: 'placeBuilding'; building: BuildingId; x: number; y: number }
  | { type: 'cancelConstruction'; siteId: EntityId }
  | { type: 'layPath'; from: Tile; to: Tile }
  | { type: 'removePath'; from: Tile; to: Tile };

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
  }
}
