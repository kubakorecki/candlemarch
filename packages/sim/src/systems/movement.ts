// Walking along tile paths, plus helpers other systems use to start and stop walks.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import { blockedGrid, inBounds, tileAt, tileCenter, tileIndex, tileOfPoint } from '../grid';
import { litGrid } from '../lights';
import { findPath, type Grid } from '../pathfinding';
import { maxSpeedPercent, speedPercentAt, speedPercentGrid } from '../roads';
import { speedPercent } from '../speed';
import {
  DIAGONAL_UNITS,
  type EntityId,
  type GameState,
  type PathComponent,
  TILE_UNITS,
  type Tile,
} from '../state';
import { countStep } from '../traffic';

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

/**
 * The grid walkers path over: what blocks walking, and how fast each tile is. A Gloamling
 * (`walker`) gets `gloamlingGrid`.
 */
export function walkGrid(state: GameState, content: Content, walker?: EntityId): Grid {
  if (walker !== undefined && state.components.gloamling[walker]) {
    return gloamlingGrid(state, content);
  }
  return gridOver(state, content, blockedGrid(state, content));
}

/** A walking grid with `blocked` and the map's road speeds. */
function gridOver(state: GameState, content: Content, blocked: Uint8Array): Grid {
  const { map } = state;
  return {
    width: map.width,
    height: map.height,
    blocked,
    speedPercent: speedPercentGrid(map, content),
    maxSpeedPercent: maxSpeedPercent(content),
  };
}

/**
 * The grid Gloamlings path over: Gates and tonight's lit tiles block walking too (Light is a wall,
 * ADR-0003).
 */
export function gloamlingGrid(state: GameState, content: Content): Grid {
  const grid = gridOver(state, content, blockedGrid(state, content, true));
  litGrid(state, content).forEach((lit, i) => {
    if (lit) grid.blocked[i] = 1;
  });
  return grid;
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
  const tiles = findPath(walkGrid(state, content, id), start, goalIndices);
  if (tiles === null) return false;
  delete state.components.path[id];
  if (tiles.length > 0) state.components.path[id] = { start, tiles, next: 0, progress: 0 };
  return true;
}

/**
 * Like `walkTo`, but a walker already walking first finishes the step it's on, so it doesn't
 * jump back to the tile centre it last passed. Used when a walk is replaced mid-way.
 */
export function rerouteTo(
  state: GameState,
  content: Content,
  id: EntityId,
  goals: readonly Tile[],
): boolean {
  const path = state.components.path[id];
  if (!path) return walkTo(state, content, id, goals);
  const { map } = state;
  const { from, to } = segment(path);
  const goalIndices = goals
    .filter((g) => inBounds(map, g.x, g.y))
    .map((g) => tileIndex(map, g.x, g.y));
  const rest = findPath(walkGrid(state, content, id), to, goalIndices);
  if (rest === null) return false;
  state.components.path[id] = {
    start: from,
    tiles: [to, ...rest],
    next: 0,
    progress: path.progress,
  };
  return true;
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

/** Off-road walking speed of a villager (from its Job), hero or Gloamling, in milli-tiles per tick. */
function walkSpeedOf(state: GameState, content: Content, id: EntityId): number | undefined {
  const job = state.components.villager[id]?.job;
  if (job !== undefined) return content.jobs[job].walkSpeed;
  const hero = state.components.hero[id]?.type;
  if (hero !== undefined) return content.heroes[hero].walkSpeed;
  if (state.components.gloamling[id]) return content.combat.gloamling.walkSpeed;
  return undefined;
}

/**
 * Advances every walker (villagers, the hero and Gloamlings) by its walk speed, faster on roads and slower
 * for a slowed villager (`speedPercent`). Removes the walk (its `PathComponent`) on arrival.
 * Counts each Carrier step onto a Road tile (`countStep`) for road traffic.
 */
export function movementSystem(state: GameState, content: Content): void {
  const { map } = state;
  const { path: paths, position } = state.components;
  for (const id of idsOf(paths)) {
    const path = paths[id];
    const speed = walkSpeedOf(state, content, id);
    if (!path || speed === undefined) continue;

    // Speed depends on the tile being walked onto. Budget left over after reaching a tile
    // centre is rescaled to the next segment's speed. Slowdowns such as Tired scale it all.
    const own = speedPercent(state, content, id);
    let percent = speedPercentAt(map, content, segment(path).to);
    let budget = Math.trunc((speed * percent * own) / 10000);
    while (budget > 0 && path.next < path.tiles.length) {
      const { from, to } = segment(path);
      const left = segmentLength(map.width, from, to) - path.progress;
      if (budget >= left) {
        budget -= left;
        countStep(state, content, id, to);
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
