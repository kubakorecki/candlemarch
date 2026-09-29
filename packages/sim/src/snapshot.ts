// Snapshots for the client, split in two: the static layers (terrain, Roads, map objects), which
// change seldom and hold most of the bytes, and the moving part (everything else). The sim bumps
// `state.staticVersion` whenever a static layer changes, so the worker sends those layers only
// when the version has moved on since it last sent them. ADR-0004.
import type { GameState, MapObjectComponent, MapState, Store, Tile } from './state';

/**
 * Records that a static layer changed: terrain, a Road, or a map object (added, removed, its
 * `amount` or `withered`). Call it after every such change, and only then.
 */
export function staticChanged(state: GameState): void {
  state.staticVersion += 1;
}

/** The static layers of a state, as sent to the client whenever `version` has moved on. */
export interface StaticLayers {
  /** The `staticVersion` they were taken at. */
  version: number;
  terrain: MapState['terrain'];
  roads: MapState['roads'];
  mapObject: Store<MapObjectComponent>;
  /** The `tile` of each map object. */
  mapObjectTile: Store<Tile>;
}

/**
 * `state`'s static layers. They share objects with `state` rather than copying them: post them or
 * copy them before `state` steps on.
 */
export function staticLayers(state: GameState): StaticLayers {
  const { mapObject, tile } = state.components;
  const mapObjectTile: Store<Tile> = {};
  for (const key in mapObject) {
    const at = tile[Number(key)];
    if (at) mapObjectTile[Number(key)] = at;
  }
  return {
    version: state.staticVersion,
    terrain: state.map.terrain,
    roads: state.map.roads,
    mapObject,
    mapObjectTile,
  };
}

/**
 * Everything in `state` but its static layers: a `GameState` whose terrain, Roads and map objects
 * are empty and whose `tile` store leaves out the map objects' tiles. Shallow: it shares every
 * other object with `state`, so post it or copy it before `state` steps on.
 */
export function movingPart(state: GameState): GameState {
  const { mapObject, tile } = state.components;
  const movingTile: Store<Tile> = {};
  for (const key in tile) {
    const id = Number(key);
    if (mapObject[id] === undefined) movingTile[id] = tile[id] as Tile;
  }
  return {
    ...state,
    map: { ...state.map, terrain: [], roads: {} },
    components: { ...state.components, mapObject: {}, tile: movingTile },
  };
}

/** The whole state again, from a moving part and the latest static layers. */
export function joinSnapshot(moving: GameState, layers: StaticLayers): GameState {
  return {
    ...moving,
    map: { ...moving.map, terrain: layers.terrain, roads: layers.roads },
    components: {
      ...moving.components,
      mapObject: layers.mapObject,
      tile: { ...layers.mapObjectTile, ...moving.components.tile },
    },
  };
}
