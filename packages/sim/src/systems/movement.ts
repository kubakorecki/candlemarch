// Walking along tile paths, plus helpers other systems use to start and stop walks.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import { blockedGrid, inBounds, tileAt, tileCenter, tileIndex, tileOfPoint } from '../grid';
import { findPath, type Grid } from '../pathfinding';
import { maxSpeedPercent, speedPercentAt, speedPercentGrid } from '../roads';
import {
  DIAGONAL_UNITS,
  type EntityId,
  type GameState,
  type PathComponent,
  TILE_UNITS,
  type Tile,
} from '../state';

/** Tile the villager is standing on (or walking through). */
export function villagerTile(state: GameState, id: EntityId): Tile | null {
  const pos = state.components.position[id];
  return pos ? tileOfPoint(pos) : null;
}

/** Whether the villager has finished walking and stands on `tile`. */
export function isAt(state: GameState, id: EntityId, tile: Tile): boolean {
  if (state.components.path[id]) return false;
  const t = villagerTile(state, id);
  return t !== null && t.x === tile.x && t.y === tile.y;
}

/** The grid walkers path over: what blocks walking, and how fast each tile is. */
export function walkGrid(state: GameState, content: Content): Grid {
  const { map } = state;
  return {
    width: map.width,
    height: map.height,
    blocked: blockedGrid(state, content),
    speedPercent: speedPercentGrid(map, content),
    maxSpeedPercent: maxSpeedPercent(content),
  };
}

/**
 * Starts a walk along the quickest route to the nearest reachable tile in `goals`. Returns false
 * (and changes nothing) if none is reachable. Returns true without a path when already on a goal.
 */
export function walkTo(
  state: GameState,
  content: Content,
  id: EntityId,
  goals: readonly Tile[],
): boolean {
  const { map } = state;
  const here = villagerTile(state, id);
  if (!here) return false;
  const goalIndices = goals
    .filter((g) => inBounds(map, g.x, g.y))
    .map((g) => tileIndex(map, g.x, g.y));
  const start = tileIndex(map, here.x, here.y);
  const tiles = findPath(walkGrid(state, content), start, goalIndices);
  if (tiles === null) return false;
  delete state.components.path[id];
  if (tiles.length > 0) state.components.path[id] = { start, tiles, next: 0, progress: 0 };
  return true;
}

/**
 * Starts a walk through `tiles` (tile indices, each a step from the one before), starting from
 * the tile the villager stands on. Used where the route is fixed, such as along a road.
 */
export function walkAlong(state: GameState, id: EntityId, tiles: readonly number[]): void {
  const here = villagerTile(state, id);
  if (!here) return;
  delete state.components.path[id];
  if (tiles.length > 0) {
    const start = tileIndex(state.map, here.x, here.y);
    state.components.path[id] = { start, tiles: [...tiles], next: 0, progress: 0 };
  }
}

/** Cuts the current walk short so it ends at the tile being walked towards. */
export function stopAtNextTile(state: GameState, id: EntityId): void {
  const path = state.components.path[id];
  if (path) path.tiles = path.tiles.slice(0, path.next + 1);
}

/** Tile indices of the segment currently being walked. */
function segment(path: PathComponent): { from: number; to: number } {
  const from = path.next === 0 ? path.start : (path.tiles[path.next - 1] as number);
  return { from, to: path.tiles[path.next] as number };
}

function segmentLength(width: number, from: number, to: number): number {
  const diagonal =
    from % width !== to % width && Math.floor(from / width) !== Math.floor(to / width);
  return diagonal ? DIAGONAL_UNITS : TILE_UNITS;
}

/**
 * Advances every walking villager by its job's walk speed, faster on roads. Removes the walk
 * (its `PathComponent`) on arrival.
 */
export function movementSystem(state: GameState, content: Content): void {
  const { map } = state;
  const { path: paths, position, villager } = state.components;
  for (const id of idsOf(paths)) {
    const path = paths[id];
    const job = villager[id]?.job;
    if (!path || job === undefined) continue;

    // Speed depends on the tile being walked onto. Budget left over after reaching a tile
    // centre is rescaled to the next segment's speed.
    let percent = speedPercentAt(map, content, segment(path).to);
    let budget = Math.trunc((content.jobs[job].walkSpeed * percent) / 100);
    while (budget > 0 && path.next < path.tiles.length) {
      const { from, to } = segment(path);
      const left = segmentLength(map.width, from, to) - path.progress;
      if (budget >= left) {
        budget -= left;
        path.progress = 0;
        path.next += 1;
        if (path.next < path.tiles.length) {
          const nextPercent = speedPercentAt(map, content, segment(path).to);
          budget = Math.trunc((budget * nextPercent) / percent);
          percent = nextPercent;
        }
      } else {
        path.progress += budget;
        budget = 0;
      }
    }

    if (path.next >= path.tiles.length) {
      position[id] = tileCenter(tileAt(map, path.tiles[path.tiles.length - 1] as number));
      delete paths[id];
      continue;
    }

    const { from, to } = segment(path);
    const a = tileCenter(tileAt(map, from));
    const b = tileCenter(tileAt(map, to));
    const len = segmentLength(map.width, from, to);
    position[id] = {
      x: a.x + Math.trunc(((b.x - a.x) * path.progress) / len),
      y: a.y + Math.trunc(((b.y - a.y) * path.progress) / len),
    };
  }
}
