// Groundwork (spec, World and map: Terrain): Drains over Swamp and Pass roads over Pass snow. Laid
// by dragging like a Road, one construction site per tile, built like any site. A finished site
// leaves no building: it changes its tile for good (`finishGroundwork`).
import type { BuildingId, Content, GroundworkDef } from '@candlemarch/content';
import { createEntity, destroyEntity, idsOf } from './entities';
import { allRevealed } from './fog';
import { clearGrowth, isGrowing } from './forest';
import { blockedGrid, entityLayout, inBounds, tileIndex } from './grid';
import { mapChanged } from './mapCache';
import { lShapeTiles } from './roads';
import { staticChanged } from './snapshot';
import type { EntityId, GameState, Tile } from './state';

/** The groundwork `type` is, or undefined if it's another kind of building. */
export function groundworkOf(content: Content, type: BuildingId): GroundworkDef | undefined {
  return content.buildings[type]?.groundwork;
}

/** Tile indices under every building's and site's footprint, and under every map object but a Sapling. */
function takenTiles(state: GameState, content: Content): Set<number> {
  const { map } = state;
  const taken = new Set<number>();
  for (const id of idsOf(state.components.tile)) {
    if (state.components.mapObject[id]) {
      // Something growing (a Sapling) gives way to groundwork.
      if (isGrowing(state, content, id)) continue;
      const t = state.components.tile[id];
      if (t) taken.add(tileIndex(map, t.x, t.y));
      continue;
    }
    for (const t of entityLayout(state, content, id)?.tiles ?? []) {
      if (inBounds(map, t.x, t.y)) taken.add(tileIndex(map, t.x, t.y));
    }
  }
  return taken;
}

/** Whether tile `i` already holds what groundwork `def` makes, or a site that will make it. */
function alreadyDone(state: GameState, def: GroundworkDef, sites: Set<number>, i: number): boolean {
  if (sites.has(i)) return true;
  return 'road' in def.becomes && state.map.roads[i] === def.becomes.road;
}

/** Tile indices holding a `type` site. */
function sitesOf(state: GameState, type: BuildingId): Set<number> {
  const tiles = new Set<number>();
  for (const id of idsOf(state.components.site)) {
    const t = state.components.tile[id];
    if (t && state.components.site[id]?.type === type) tiles.add(tileIndex(state.map, t.x, t.y));
  }
  return tiles;
}

/**
 * The tiles of the L from `from` to `to` that would get a new `type` site, in walking order:
 * every tile but those already done (a `type` site on it, or the Road it makes). Null if `type`
 * isn't groundwork, an end is off the map, any tile is unrevealed, any other tile isn't the
 * groundwork's terrain or holds a Road, a map object or a footprint, or no tile would get a site.
 */
function groundworkLine(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): Tile[] | null {
  const def = groundworkOf(content, type);
  if (!def || !content.buildings[type]?.placeable) return null;
  const { map } = state;
  if (![from, to].every((t) => inBounds(map, t.x, t.y))) return null;
  const all = lShapeTiles(from, to);
  if (!allRevealed(state, all)) return null;
  const sites = sitesOf(state, type);
  const line = all.filter((t) => !alreadyDone(state, def, sites, tileIndex(map, t.x, t.y)));
  if (line.length === 0) return null;
  const taken = takenTiles(state, content);
  const fits = line.every((t) => {
    const i = tileIndex(map, t.x, t.y);
    return map.terrain[i] === def.on && map.roads[i] === undefined && !taken.has(i);
  });
  return fits ? line : null;
}

/** Whether `type` groundwork (a Drain or a Pass road) can be laid along the L now. */
export function canLayGroundwork(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): boolean {
  return groundworkLine(state, content, type, from, to) !== null;
}

/**
 * Lays `type` groundwork along the L from `from` to `to`: a construction site on each tile not
 * already done, in walking order. Nothing if any of them can't take one.
 */
export function layGroundwork(
  state: GameState,
  content: Content,
  type: BuildingId,
  from: Tile,
  to: Tile,
): void {
  const line = groundworkLine(state, content, type, from, to);
  if (!line) return;
  clearGrowth(state, content, line);
  for (const t of line) {
    const id = createEntity(state);
    state.components.tile[id] = { x: t.x, y: t.y };
    state.components.site[id] = { type, rotation: 0, delivered: {}, buildProgress: 0 };
  }
}

/**
 * Finishes groundwork site `id`: the site goes, and its tile turns into the groundwork's terrain
 * or gets its Road. Construction calls it in place of putting up a building.
 */
export function finishGroundwork(state: GameState, id: EntityId, def: GroundworkDef): void {
  const t = state.components.tile[id];
  destroyEntity(state, id);
  if (!t) return;
  const i = tileIndex(state.map, t.x, t.y);
  if ('terrain' in def.becomes) state.map.terrain[i] = def.becomes.terrain;
  else state.map.roads[i] = def.becomes.road;
  mapChanged(state);
  staticChanged(state);
}

/**
 * Where Carriers stand to deliver to groundwork site `id`: its own tile, or, where nobody but
 * the Hero walks (Pass snow), the walkable tiles beside it (orthogonally), so a Pass road is
 * supplied from the tile finished before it. Empty if `id` isn't a groundwork site, or nothing
 * beside it can be walked on yet (then its door, the snow tile, can't be reached either).
 */
export function groundworkDropTiles(state: GameState, content: Content, id: EntityId): Tile[] {
  const site = state.components.site[id];
  const t = state.components.tile[id];
  if (!site || !t || !groundworkOf(content, site.type)) return [];
  const { map } = state;
  const blocked = blockedGrid(state, content);
  const here = tileIndex(map, t.x, t.y);
  if (blocked[here] === 0) return [t];
  const beside = [
    { x: t.x + 1, y: t.y },
    { x: t.x, y: t.y + 1 },
    { x: t.x - 1, y: t.y },
    { x: t.x, y: t.y - 1 },
  ];
  return beside.filter((n) => inBounds(map, n.x, n.y) && blocked[tileIndex(map, n.x, n.y)] === 0);
}
