// Things growing into Forest: Saplings, planted by a forester or sprouted from the Stump a felled
// tree leaves. They don't block walking, nobody gathers them, and they count as a standing tree
// only once grown (then they are a `tree`). The forester's rules for where to plant live here too.
import type { Content, GrowsDef, PlantsDef } from '@candlemarch/content';
import { createEntity, destroyEntity, idsOf } from './entities';
import { refreshShade } from './forage';
import { inWorkRadius } from './gathering';
import { entityLayout, inBounds, stockpileTileIndices, tileIndex } from './grid';
import { cached, mapChanged } from './mapCache';
import { staticChanged } from './snapshot';
import type { EntityId, GameState, Tile } from './state';

/** How map object `id` grows, if it's something growing (a Sapling or a Stump); else undefined. */
export function growsOf(state: GameState, content: Content, id: EntityId): GrowsDef | undefined {
  const obj = state.components.mapObject[id];
  return obj ? content.mapObjects[obj.type].grows : undefined;
}

/** Whether map object `id` is something growing (a Sapling or a Stump). */
export function isGrowing(state: GameState, content: Content, id: EntityId): boolean {
  return growsOf(state, content, id) !== undefined;
}

/**
 * Puts a new Sapling on `tile`, starting to grow now. Returns its ID, or null if the tile is off
 * the map. Doesn't check the tile is free: the forester does (`canPlant`).
 */
export function plantSapling(state: GameState, content: Content, tile: Tile): EntityId | null {
  if (!inBounds(state.map, tile.x, tile.y)) return null;
  const id = createEntity(state);
  state.components.tile[id] = { x: tile.x, y: tile.y };
  state.components.mapObject[id] = { type: 'sapling', amount: 0 };
  startGrowing(state, content, id);
  staticChanged(state);
  return id;
}

/** Sets map object `id`, something growing, to start growing now, at stage 0. */
function startGrowing(state: GameState, content: Content, id: EntityId): void {
  const obj = state.components.mapObject[id];
  const grows = growsOf(state, content, id);
  if (!obj || !grows) return;
  obj.growsAt = state.tick + grows.days * content.calendar.dayTicks;
  obj.stage = 0;
}

/**
 * Turns tree `id`, just felled, into a Stump, starting to grow now. It stops blocking walking.
 * `fellTree` calls it; the shade and Game it took are that function's business.
 */
export function leaveStump(state: GameState, content: Content, id: EntityId): void {
  if (!state.components.mapObject[id]) return;
  state.components.mapObject[id] = { type: 'stump', amount: 0 };
  startGrowing(state, content, id);
  mapChanged(state);
  staticChanged(state);
}

/**
 * Brings something growing (`id`) along at a Dawn: past its `growsAt` it turns into what it grows
 * into (a Stump into a Sapling; a Sapling into a tree, which blocks walking and shades), else its
 * drawing stage follows the time gone. Nothing for other map objects.
 */
export function grow(state: GameState, content: Content, id: EntityId): void {
  const obj = state.components.mapObject[id];
  const grows = growsOf(state, content, id);
  const at = state.components.tile[id];
  if (!obj || !grows || obj.growsAt === undefined || !at) return;
  if (state.tick < obj.growsAt) {
    const total = grows.days * content.calendar.dayTicks;
    const gone = total - (obj.growsAt - state.tick);
    const stage = Math.min(grows.stages - 1, Math.floor((gone * grows.stages) / total));
    if (stage !== obj.stage) {
      obj.stage = stage;
      staticChanged(state);
    }
    return;
  }
  const into = content.mapObjects[grows.into];
  state.components.mapObject[id] = { type: into.id, amount: into.amount };
  if (into.grows) {
    startGrowing(state, content, id);
  } else {
    // A tree: it blocks walking now, and shades.
    mapChanged(state);
    refreshShade(state, content, at);
  }
  staticChanged(state);
}

/**
 * Clears everything growing on `tiles`, Fields (`fields.ts`) included: a building, Road, Stockpile
 * or groundwork put there takes its place.
 */
export function clearGrowth(state: GameState, content: Content, tiles: readonly Tile[]): void {
  const { map } = state;
  const under = new Set(
    tiles.filter((t) => inBounds(map, t.x, t.y)).map((t) => tileIndex(map, t.x, t.y)),
  );
  let fieldsLost = false;
  for (const i of under) {
    if (map.fields[i] === undefined) continue;
    delete map.fields[i];
    fieldsLost = true;
  }
  if (fieldsLost) staticChanged(state);
  for (const id of idsOf(state.components.mapObject)) {
    const at = state.components.tile[id];
    if (at && isGrowing(state, content, id) && under.has(tileIndex(map, at.x, at.y))) {
      destroyEntity(state, id);
    }
  }
}

/**
 * Tiles nothing may be planted on, whatever the terrain: under a map object, Road, Stockpile,
 * building or site (footprint or door), Den or cache, and the entry tile. Cached until the map
 * changes, so don't write to it.
 */
function unplantableGrid(state: GameState, content: Content): Uint8Array {
  return cached(state, content, 'unplantable', () => {
    const { map } = state;
    const grid = new Uint8Array(map.width * map.height);
    const mark = (t: Tile) => {
      if (inBounds(map, t.x, t.y)) grid[tileIndex(map, t.x, t.y)] = 1;
    };
    for (const i in map.roads) grid[Number(i)] = 1;
    for (const id of idsOf(state.components.tile)) {
      const layout = entityLayout(state, content, id);
      if (layout) {
        for (const t of layout.tiles) mark(t);
        mark(layout.door);
      } else if (state.components.stockpile[id]) {
        for (const i of stockpileTileIndices(state, id)) grid[i] = 1;
      } else {
        mark(state.components.tile[id] as Tile); // a map object, Den or cache
      }
    }
    if (map.entry) mark(map.entry);
    return grid;
  });
}

/**
 * Whether nothing stands on `tile` (`unplantableGrid`): no map object, Road, Stockpile, building
 * or site, Den or cache, and it isn't the entry. False off the map. Fields must be open ground.
 */
export function isOpenGround(state: GameState, content: Content, tile: Tile): boolean {
  const { map } = state;
  if (!inBounds(map, tile.x, tile.y)) return false;
  return unplantableGrid(state, content)[tileIndex(map, tile.x, tile.y)] === 0;
}

/** The planting rules of lodge `lodgeId`, or undefined if it isn't a building that plants. */
function plantsOf(state: GameState, content: Content, lodgeId: EntityId): PlantsDef | undefined {
  const b = state.components.building[lodgeId];
  return b ? content.buildings[b.type].plants : undefined;
}

/**
 * Whether lodge `lodgeId`'s foresters may plant on `tile` now: within its work radius, on its
 * `on` terrain, on the `spacing` grid, with nothing on it (`unplantableGrid`) and not a Field.
 * Fog doesn't matter: it hides the world from the player, not from the forester.
 */
export function canPlant(
  state: GameState,
  content: Content,
  lodgeId: EntityId,
  tile: Tile,
): boolean {
  const plants = plantsOf(state, content, lodgeId);
  return plants !== undefined && fitsPlot(state, content, plants, lodgeId, tile);
}

function fitsPlot(
  state: GameState,
  content: Content,
  plants: PlantsDef,
  lodgeId: EntityId,
  tile: Tile,
): boolean {
  const { map } = state;
  if (!inBounds(map, tile.x, tile.y)) return false;
  if (tile.x % plants.spacing !== 0 || tile.y % plants.spacing !== 0) return false;
  const i = tileIndex(map, tile.x, tile.y);
  return (
    map.terrain[i] === plants.on &&
    unplantableGrid(state, content)[i] === 0 &&
    map.fields[i] === undefined &&
    inWorkRadius(state, content, lodgeId, tile)
  );
}

/** Every tile lodge `lodgeId`'s foresters may plant on now (`canPlant`), row-major. */
export function plantableTiles(state: GameState, content: Content, lodgeId: EntityId): Tile[] {
  const lodge = state.components.building[lodgeId];
  const layout = entityLayout(state, content, lodgeId);
  const plants = lodge ? content.buildings[lodge.type].plants : undefined;
  if (!lodge || !layout || !plants) return [];
  const { map } = state;
  const reach = content.buildings[lodge.type].workRadius ?? Math.max(map.width, map.height);
  const { origin, size } = layout;
  const tiles: Tile[] = [];
  for (let y = Math.max(0, origin.y - reach); y < origin.y + size.h + reach; y++) {
    for (let x = Math.max(0, origin.x - reach); x < origin.x + size.w + reach; x++) {
      if (fitsPlot(state, content, plants, lodgeId, { x, y })) tiles.push({ x, y });
    }
  }
  return tiles;
}
