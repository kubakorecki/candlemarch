// Hunting grounds: rectangles of forest holding Game. The ceiling follows the trees standing in a
// ground; felling one drives the Game above the new ceiling away at once. Nothing recovers (M4).
import type { BuildingId, Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { refreshShade } from './forage';
import { leaveStump } from './forest';
import { inWorkRadius } from './gathering';
import { buildingLayout } from './grid';
import type { EntityId, GameState, HuntingGroundComponent, Rotation, Tile } from './state';

/** The health word for a ground, from its Game as a share of its max Game. */
export type GroundHealth = 'thriving' | 'thinning' | 'scarce' | 'empty';

/** Whether `tile` lies in `ground`'s rectangle. */
export function inGround(ground: HuntingGroundComponent, tile: Tile): boolean {
  return (
    tile.x >= ground.x &&
    tile.x < ground.x + ground.w &&
    tile.y >= ground.y &&
    tile.y < ground.y + ground.h
  );
}

/** Tiles of Hunting ground `groundId` within building `id`'s work radius, row-major. */
export function groundTilesInReach(
  state: GameState,
  content: Content,
  id: EntityId,
  groundId: EntityId,
): Tile[] {
  const ground = state.components.huntingGround[groundId];
  if (!ground) return [];
  const tiles: Tile[] = [];
  for (let y = ground.y; y < ground.y + ground.h; y++) {
    for (let x = ground.x; x < ground.x + ground.w; x++) {
      if (inWorkRadius(state, content, id, { x, y })) tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Hunting grounds a `type` building at `origin` would reach: those with a tile within its work
 * radius (Chebyshev from the footprint; every ground for a building without one), in ID order.
 */
export function groundsNear(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): EntityId[] {
  const def = content.buildings[type];
  const { size } = buildingLayout(def, origin, rotation);
  const { workRadius } = def;
  const r = workRadius ?? Number.POSITIVE_INFINITY;
  return idsOf(state.components.huntingGround).filter((g) => {
    const ground = state.components.huntingGround[g];
    if (!ground) return false;
    const dx = Math.max(
      0,
      origin.x - (ground.x + ground.w - 1),
      ground.x - (origin.x + size.w - 1),
    );
    const dy = Math.max(
      0,
      origin.y - (ground.y + ground.h - 1),
      ground.y - (origin.y + size.h - 1),
    );
    return Math.max(dx, dy) <= r;
  });
}

/** Hunting grounds overlapping building `id`'s work radius, in ID order. */
export function groundsInReach(state: GameState, content: Content, id: EntityId): EntityId[] {
  const b = state.components.building[id];
  const origin = state.components.tile[id];
  return b && origin ? groundsNear(state, content, b.type, origin, b.rotation) : [];
}

/** Forest map objects (content `hunting.forest`) standing in `ground`. */
export function standingTrees(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): number {
  const { mapObject, tile } = state.components;
  let count = 0;
  for (const id of idsOf(mapObject)) {
    const at = tile[id];
    if (mapObject[id]?.type === content.hunting.forest && at && inGround(ground, at)) count += 1;
  }
  return count;
}

/** Most Game `ground` holds with the forest standing now: `trunc(max × standing ÷ start)`. */
export function groundCeiling(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): number {
  if (ground.startTrees === 0) return ground.maxGame;
  const standing = standingTrees(state, content, ground);
  return Math.trunc((ground.maxGame * standing) / ground.startTrees);
}

/** Chance a hunt in `ground` catches something, in permille: max chance × Game ÷ max Game. */
export function huntChancePermille(ground: HuntingGroundComponent, content: Content): number {
  if (ground.maxGame === 0) return 0;
  return Math.trunc((content.hunting.maxCatchPermille * ground.game) / ground.maxGame);
}

export function groundHealth(ground: HuntingGroundComponent, content: Content): GroundHealth {
  const { thrivingPercent, scarcePercent } = content.hunting;
  if (ground.game <= 0) return 'empty';
  if (ground.game * 100 >= thrivingPercent * ground.maxGame) return 'thriving';
  if (ground.game * 100 < scarcePercent * ground.maxGame) return 'scarce';
  return 'thinning';
}

/**
 * Fells tree `id`: it becomes a Stump (same ID), which will sprout a Sapling. Forage patches it
 * shaded may wither. In every Hunting ground it stood in, Game above the new ceiling flees at once
 * and is counted in the ground's `fled`.
 */
export function fellTree(state: GameState, content: Content, id: EntityId): void {
  const at = state.components.tile[id];
  if (!at) return;
  leaveStump(state, content, id);
  refreshShade(state, content, at);
  for (const groundId of idsOf(state.components.huntingGround)) {
    const ground = state.components.huntingGround[groundId];
    if (!ground || !inGround(ground, at)) continue;
    const ceiling = groundCeiling(state, content, ground);
    if (ground.game <= ceiling) continue;
    ground.fled += ground.game - ceiling;
    ground.game = ceiling;
  }
}
