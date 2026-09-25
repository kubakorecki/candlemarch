// Hand-made map definitions and building a fresh game state from one.
import type { BuildingId, Content, JobId, MapObjectId, TerrainId } from '@candlemarch/content';
import { createEntity } from './entities';
import { doorTile, fitsAt, inBounds, tileCenter } from './grid';
import { DEFAULT_LOGISTICS_MODEL, logisticsModels } from './logistics';
import { seedRng } from './rng';
import { type EntityId, type GameState, STATE_VERSION, type Tile } from './state';

export interface MapDef {
  name: string;
  /** One string per row, all the same length. See `MAP_LEGEND`. */
  rows: string[];
  /** Buildings standing at map start, by origin tile. */
  buildings: { type: BuildingId; x: number; y: number }[];
  /** Villagers without a workplace (e.g. carriers), by tile. */
  villagers: { job: JobId; x: number; y: number }[];
}

/** What each character in `MapDef.rows` stands for. */
export const MAP_LEGEND: Record<string, { terrain: TerrainId; object?: MapObjectId }> = {
  '.': { terrain: 'grass' },
  T: { terrain: 'grass', object: 'tree' },
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
  if (job === 'woodcutter') state.components.woodcutter[id] = { kind: 'idle', retryAt: 0 };
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
 * A new game on `map`. Trees are created in row-major order, then buildings with their
 * employees (spawned at the door), then free villagers. Throws if the map is malformed.
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
      state.map.terrain.push(cell.terrain);
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

  for (const v of map.villagers) {
    if (!inBounds(state.map, v.x, v.y)) {
      throw new Error(`map ${map.name}: villager out of bounds at ${v.x},${v.y}`);
    }
    spawnVillager(state, v.job, { x: v.x, y: v.y }, null);
  }

  return state;
}
