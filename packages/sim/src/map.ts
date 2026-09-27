// Hand-made map definitions and building a fresh game state from one.
import type {
  BuildingId,
  Content,
  HeroId,
  JobId,
  MapObjectId,
  RoadId,
  TerrainId,
} from '@candlemarch/content';
import { createEntity } from './entities';
import { canPlaceBuilding, doorTile, fitsAt, isWalkableTerrain, tileCenter } from './grid';
import { standingTrees } from './huntingGrounds';
import { seedRng } from './rng';
import { type EntityId, type GameState, STATE_VERSION, type Tile } from './state';
import { canPlaceStockpile, placeStockpile } from './stockpiles';
import { assignJob, drawVillagerName } from './villagers';
import { maxWorkers } from './workers';

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
  /** Where the hero starts, if the map has one. */
  hero?: { x: number; y: number };
  /** Hunting grounds: named rectangles of forest, by origin tile and size, starting full of Game. */
  huntingGrounds?: { name: string; x: number; y: number; w: number; h: number; maxGame: number }[];
}

/** The hero every map spawns, until the player picks one at game start. */
const DEFAULT_HERO: HeroId = 'placeholder';

/** What each character in `MapDef.rows` stands for. */
export const MAP_LEGEND: Record<
  string,
  { terrain: TerrainId; object?: MapObjectId; road?: RoadId }
> = {
  '.': { terrain: 'grass' },
  T: { terrain: 'grass', object: 'tree' },
  b: { terrain: 'grass', object: 'berry_bush' },
  m: { terrain: 'grass', object: 'mushroom_patch' },
  '=': { terrain: 'grass', road: 'dirt_path' },
  '~': { terrain: 'river' },
};

function spawnVillager(
  state: GameState,
  content: Content,
  job: JobId,
  tile: Tile,
  workplace: EntityId | null,
): EntityId {
  const name = drawVillagerName(state, content);
  const id = createEntity(state);
  state.components.villager[id] = {
    name,
    job,
    workplace,
    carrying: null,
    home: null,
    routine: 'work',
    sleptTicks: 0,
    tired: false,
    missedMeals: 0,
    coldNights: 0,
  };
  state.components.position[id] = tileCenter(tile);
  assignJob(state, content, id, job, workplace);
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
      hero: {},
      position: {},
      path: {},
      woodcutter: {},
      crafter: {},
      fisher: {},
      forager: {},
      hunter: {},
      huntingGround: {},
    },
    logistics: { hauls: {} },
    deaths: [],
  };
}

/**
 * A new game on `map`. Entities are created in this order: trees (row-major), buildings with
 * their employees (spawned at the door), sites, stockpiles, free villagers, the hero, then
 * Hunting grounds. Throws if the map is malformed or anything on it couldn't be placed there.
 */
export function createInitialState(seed: number, map: MapDef, content: Content): GameState {
  const height = map.rows.length;
  const width = map.rows[0]?.length ?? 0;
  if (width === 0) throw new Error(`map ${map.name}: empty`);

  const state = createEmptyState(seed);
  state.map = { width, height, terrain: [], roads: {} };

  map.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`map ${map.name}: row ${y} has length ${row.length}`);
    [...row].forEach((char, x) => {
      const cell = MAP_LEGEND[char];
      if (!cell) throw new Error(`map ${map.name}: unknown character '${char}' at ${x},${y}`);
      const index = state.map.terrain.length;
      state.map.terrain.push(cell.terrain);
      if (cell.road) state.map.roads[index] = cell.road;
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
    state.components.building[id] = {
      type: b.type,
      stock: {},
      input: {},
      workerLimit: maxWorkers(content, b.type),
      cold: false,
    };
    for (const slot of def.employs) {
      for (let i = 0; i < slot.count; i++) {
        spawnVillager(state, content, slot.job, doorTile(def, { x: b.x, y: b.y }), id);
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
    if (!isWalkableTerrain(state, content, { x: v.x, y: v.y })) {
      throw new Error(
        `map ${map.name}: villager off the map or on unwalkable terrain at ${v.x},${v.y}`,
      );
    }
    spawnVillager(state, content, v.job, { x: v.x, y: v.y }, null);
  }

  if (map.hero) {
    const { x, y } = map.hero;
    if (!isWalkableTerrain(state, content, { x, y })) {
      throw new Error(`map ${map.name}: hero off the map or on unwalkable terrain at ${x},${y}`);
    }
    const id = createEntity(state);
    state.components.hero[id] = { type: DEFAULT_HERO, carrying: null, order: null };
    state.components.position[id] = tileCenter({ x, y });
  }

  for (const g of map.huntingGrounds ?? []) {
    const { name, x, y, w, h, maxGame } = g;
    if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > width || y + h > height) {
      throw new Error(
        `map ${map.name}: hunting ground ${name} doesn't fit at ${x},${y} (${w}×${h})`,
      );
    }
    const ground = { name, x, y, w, h, maxGame, game: maxGame, startTrees: 0, fled: 0 };
    ground.startTrees = standingTrees(state, content, ground);
    state.components.huntingGround[createEntity(state)] = ground;
  }

  return state;
}
