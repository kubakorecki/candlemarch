// Hand-made map definitions and building a fresh game state from one.
import type {
  BuildingId,
  Content,
  JobId,
  MapObjectId,
  RoadId,
  TerrainId,
} from '@candlemarch/content';
import { createEntity } from './entities';
import { canPlaceBuilding, doorTile, fitsAt, inBounds, tileAt, tileCenter } from './grid';
import { DEFAULT_LOGISTICS_MODEL, logisticsModels } from './logistics';
import { canPlaceFlag } from './logistics/flagNetwork';
import { placeFlag } from './logistics/flagRelay';
import type { LogisticsModelId } from './logistics/model';
import { relayOf } from './logistics/relayState';
import { seedRng } from './rng';
import { type EntityId, type GameState, STATE_VERSION, type Tile } from './state';
import { canPlaceStockpile, placeStockpile } from './stockpiles';
import { assignJob } from './villagers';

export interface MapDef {
  name: string;
  /** One string per row, all the same length. See `MAP_LEGEND`. */
  rows: string[];
  /** Buildings standing at map start, by origin tile. */
  buildings: { type: BuildingId; x: number; y: number }[];
  /** Construction sites at map start, by origin tile. */
  sites?: { type: BuildingId; x: number; y: number }[];
  /** Stockpiles at map start, empty, by origin tile and size in tiles. */
  stockpiles?: { x: number; y: number; w: number; h: number }[];
  /** Villagers without a workplace (e.g. carriers), by tile. */
  villagers: { job: JobId; x: number; y: number }[];
}

/**
 * What each character in `MapDef.rows` stands for. A Flag only exists under flag relay; under
 * other logistics models its tile is a plain path.
 */
export const MAP_LEGEND: Record<
  string,
  { terrain: TerrainId; object?: MapObjectId; road?: RoadId; flag?: true }
> = {
  '.': { terrain: 'grass' },
  T: { terrain: 'grass', object: 'tree' },
  '=': { terrain: 'grass', road: 'dirt_path' },
  F: { terrain: 'grass', road: 'dirt_path', flag: true },
};

function spawnVillager(
  state: GameState,
  job: JobId,
  tile: Tile,
  workplace: EntityId | null,
): EntityId {
  const id = createEntity(state);
  state.components.villager[id] = { job, workplace, carrying: null };
  state.components.position[id] = tileCenter(tile);
  assignJob(state, id, job, workplace);
  return id;
}

/**
 * A game state with an empty 0×0 map and no entities. `createInitialState` builds on it, and
 * loading fills gaps in older saves from it.
 */
export function createEmptyState(seed: number): GameState {
  return {
    version: STATE_VERSION,
    tick: 0,
    rng: seedRng(seed),
    nextId: 1,
    map: { width: 0, height: 0, terrain: [], roads: {} },
    components: {
      tile: {},
      mapObject: {},
      building: {},
      site: {},
      stockpile: {},
      villager: {},
      position: {},
      path: {},
      woodcutter: {},
    },
    logistics: logisticsModels[DEFAULT_LOGISTICS_MODEL].init(),
  };
}

/**
 * A new game on `map` using logistics model `model`. Entities are created in this order: trees
 * (row-major), buildings with their employees (spawned at the door), sites, stockpiles, then
 * free villagers. Flags are placed last, in tile order. Throws if the map is malformed or
 * anything on it couldn't be placed there.
 */
export function createInitialState(
  seed: number,
  map: MapDef,
  content: Content,
  model: LogisticsModelId = DEFAULT_LOGISTICS_MODEL,
): GameState {
  const height = map.rows.length;
  const width = map.rows[0]?.length ?? 0;
  if (width === 0) throw new Error(`map ${map.name}: empty`);

  const state = createEmptyState(seed);
  state.map = { width, height, terrain: [], roads: {} };
  state.logistics = logisticsModels[model].init();
  const flags: number[] = [];

  map.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`map ${map.name}: row ${y} has length ${row.length}`);
    [...row].forEach((char, x) => {
      const cell = MAP_LEGEND[char];
      if (!cell) throw new Error(`map ${map.name}: unknown character '${char}' at ${x},${y}`);
      const index = state.map.terrain.length;
      state.map.terrain.push(cell.terrain);
      if (cell.road) state.map.roads[index] = cell.road;
      if (cell.flag) flags.push(index);
      if (cell.object) {
        const id = createEntity(state);
        state.components.tile[id] = { x, y };
        state.components.mapObject[id] = {
          type: cell.object,
          amount: content.mapObjects[cell.object].amount,
        };
      }
    });
  });

  for (const b of map.buildings) {
    if (!fitsAt(state, content, b.type, b.x, b.y)) {
      throw new Error(`map ${map.name}: ${b.type} doesn't fit at ${b.x},${b.y}`);
    }
    const def = content.buildings[b.type];
    const id = createEntity(state);
    state.components.tile[id] = { x: b.x, y: b.y };
    state.components.building[id] = { type: b.type, stock: {} };
    for (const slot of def.employs) {
      for (let i = 0; i < slot.count; i++) {
        spawnVillager(state, slot.job, doorTile(def, { x: b.x, y: b.y }), id);
      }
    }
  }

  for (const site of map.sites ?? []) {
    if (!canPlaceBuilding(state, content, site.type, site.x, site.y)) {
      throw new Error(`map ${map.name}: ${site.type} site can't be placed at ${site.x},${site.y}`);
    }
    const id = createEntity(state);
    state.components.tile[id] = { x: site.x, y: site.y };
    state.components.site[id] = { type: site.type, delivered: {}, buildProgress: 0 };
  }

  for (const { x, y, w, h } of map.stockpiles ?? []) {
    if (!canPlaceStockpile(state, content, x, y, w, h)) {
      throw new Error(`map ${map.name}: stockpile can't be placed at ${x},${y} (${w}×${h})`);
    }
    placeStockpile(state, content, x, y, w, h);
  }

  for (const v of map.villagers) {
    if (!inBounds(state.map, v.x, v.y)) {
      throw new Error(`map ${map.name}: villager out of bounds at ${v.x},${v.y}`);
    }
    spawnVillager(state, v.job, { x: v.x, y: v.y }, null);
  }

  if (relayOf(state)) {
    for (const index of flags) {
      const { x, y } = tileAt(state.map, index);
      if (!canPlaceFlag(state, content, x, y)) {
        throw new Error(`map ${map.name}: Flag can't be placed at ${x},${y}`);
      }
      placeFlag(state, content, x, y);
    }
  }

  return state;
}
