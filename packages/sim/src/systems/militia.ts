// The militia at the bell (`militia.ts`). While the bell rings, each villager it called walks to
// the nearest Gloamling within the bell's range and stands once it's in reach; with none there it
// waits at the bell's door. The hits are the combat system's. Dawn stands the militia down, and so
// does the bell being gone.
import type { Content } from '@candlemarch/content';
import { isDawn } from '../calendar';
import { inReach, militiaTarget } from '../combat';
import { idsOf } from '../entities';
import { entityDoor, tileIndex } from '../grid';
import { bellOf, isBellRung, standDown } from '../militia';
import type { EntityId, GameState, Tile } from '../state';
import { isAt, rerouteTo, stopAtNextTile, villagerTile } from './movement';

export function militiaSystem(state: GameState, content: Content): void {
  if (!isBellRung(state)) return;
  const bell = bellOf(state, content);
  const door = bell === null ? null : entityDoor(state, content, bell);
  if (isDawn(state.tick, content) || door === null) {
    standDown(state);
    return;
  }
  const { villager } = state.components;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    // One a Gloamling has reached stands and fights it (`systems/combat.ts`).
    if (v?.militia && !v.fighting) muster(state, content, id, door);
  }
}

/** Walks militia villager `id` after its Gloamling, or to the bell's `door` with none. */
function muster(state: GameState, content: Content, id: EntityId, door: Tile): void {
  const foe = militiaTarget(state, content, id);
  const at = foe === null ? null : villagerTile(state, foe);
  if (foe !== null && at !== null) {
    if (inReach(state, id, foe, content.combat.villager.reachTiles)) {
      stopAtNextTile(state, id);
      return;
    }
    if (walkOn(state, content, id, at)) return;
  }
  if (!walkOn(state, content, id, door)) stopAtNextTile(state, id);
}

/**
 * Keeps villager `id` walking to `goal`, rerouting only when its walk ends elsewhere. False if
 * it can't get there.
 */
function walkOn(state: GameState, content: Content, id: EntityId, goal: Tile): boolean {
  const path = state.components.path[id];
  if (path && path.tiles[path.tiles.length - 1] === tileIndex(state.map, goal.x, goal.y)) {
    return true;
  }
  if (isAt(state, id, goal)) return true;
  return rerouteTo(state, content, id, [goal]);
}
