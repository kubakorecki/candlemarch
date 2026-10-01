// Snapshots for the client, split in two: the static layers (terrain, Roads, map objects, the
// Revealed tiles, the Reserve, the Fields, Hunting grounds' tiles), which
// change seldom and hold most of the bytes, and the moving part (everything else). The sim bumps
// `state.staticVersion` whenever a static layer changes, so the worker sends those layers whole
// once per game and afterwards, when the version moves on, only a patch of what changed.
// ADR-0004.
import type {
  EntityId,
  FieldTile,
  GameState,
  HuntingGroundComponent,
  MapObjectComponent,
  MapState,
  Store,
  Tile,
} from './state';

/**
 * Records that a static layer changed: terrain, a Road, a map object (added, removed, its
 * `amount` or `withered`), a tile Revealed, the Reserve painted or erased, a Field painted, erased
 * or worked, or a Hunting ground added. Call it after every such
 * change, and only then.
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
  /** Fog: the tiles Revealed (`TileBits`), whether Fog is on or not; the moving part says. */
  revealed: MapState['revealed'];
  /** The Reserve's tiles (`TileBits`). */
  reserve: MapState['reserve'];
  /** The Fields, by tile index. */
  fields: MapState['fields'];
  mapObject: Store<MapObjectComponent>;
  /** The `tile` of each map object. */
  mapObjectTile: Store<Tile>;
  /** Each Hunting ground's `tiles`, by ground ID; the rest of the ground is in the moving part. */
  groundTiles: Store<number[]>;
}

/** Each Hunting ground's `tiles`, by ground ID (the lists shared with `state`). */
function groundTilesOf(state: GameState): Store<number[]> {
  const { huntingGround } = state.components;
  const tiles: Store<number[]> = {};
  for (const key in huntingGround) {
    tiles[Number(key)] = (huntingGround[Number(key)] as HuntingGroundComponent).tiles;
  }
  return tiles;
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
    revealed: state.map.revealed,
    reserve: state.map.reserve,
    fields: state.map.fields,
    mapObject,
    mapObjectTile,
    groundTiles: groundTilesOf(state),
  };
}

/**
 * What changed in the static layers since they were last sent: terrain, Roads, the Revealed
 * tiles, the Reserve, the Fields and the Hunting grounds' tiles whole, or null when unchanged, and only the map objects added or changed (with their tiles) or removed. A chop
 * changes one tree, so its patch is a few bytes where the whole layers are hundreds of KB.
 */
export interface StaticPatch {
  /** The `staticVersion` it brings the layers up to. */
  version: number;
  terrain: MapState['terrain'] | null;
  roads: MapState['roads'] | null;
  revealed: MapState['revealed'] | null;
  reserve: MapState['reserve'] | null;
  fields: MapState['fields'] | null;
  /** Every Hunting ground's tiles when any changed (a ground added or gone), else null. */
  groundTiles: Store<number[]> | null;
  mapObject: Store<MapObjectComponent>;
  mapObjectTile: Store<Tile>;
  removed: EntityId[];
}

/**
 * A copy of `state`'s static layers sharing nothing with it: what a client holds once they're
 * sent, kept by the sender to work out patches against (`staticPatch`).
 */
export function sentStaticLayers(state: GameState): StaticLayers {
  const layers = staticLayers(state);
  const mapObject: Store<MapObjectComponent> = {};
  const mapObjectTile: Store<Tile> = {};
  for (const key in layers.mapObject) {
    const id = Number(key);
    mapObject[id] = { ...(layers.mapObject[id] as MapObjectComponent) };
    const at = layers.mapObjectTile[id];
    if (at) mapObjectTile[id] = { ...at };
  }
  return {
    version: layers.version,
    terrain: [...layers.terrain],
    roads: { ...layers.roads },
    revealed: [...layers.revealed],
    reserve: [...layers.reserve],
    fields: copyFields(layers.fields),
    mapObject,
    mapObjectTile,
    groundTiles: copyGroundTiles(layers.groundTiles),
  };
}

function copyFields(fields: MapState['fields']): MapState['fields'] {
  const copy: MapState['fields'] = {};
  for (const key in fields) copy[Number(key)] = { ...(fields[Number(key)] as FieldTile) };
  return copy;
}

/** Whether two sets of Fields hold the same tiles, each the same. */
function sameFieldTiles(a: MapState['fields'], b: MapState['fields']): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => {
    const other = b[Number(k)];
    return other !== undefined && sameFields(a[Number(k)] as FieldTile, other);
  });
}

function copyGroundTiles(groundTiles: Store<number[]>): Store<number[]> {
  const copy: Store<number[]> = {};
  for (const key in groundTiles) copy[Number(key)] = [...(groundTiles[Number(key)] as number[])];
  return copy;
}

/** Whether two stores of tile lists hold the same IDs and lists. */
function sameGroundTiles(a: Store<number[]>, b: Store<number[]>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => {
    const other = b[Number(k)];
    return other !== undefined && sameList(a[Number(k)] as number[], other);
  });
}

/** Whether two flat records hold the same fields and values. */
function sameFields<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/**
 * What changed in `state`'s static layers since `sent` (from `sentStaticLayers`), which it brings
 * up to date. Shares objects with `state`, like `staticLayers`: post it before `state` steps on.
 */
export function staticPatch(sent: StaticLayers, state: GameState): StaticPatch {
  const { terrain, roads, revealed, reserve, fields } = state.map;
  const { mapObject, tile } = state.components;
  const patch: StaticPatch = {
    version: state.staticVersion,
    terrain: null,
    roads: null,
    revealed: null,
    reserve: null,
    fields: null,
    groundTiles: null,
    mapObject: {},
    mapObjectTile: {},
    removed: [],
  };
  if (!sameList(sent.terrain, terrain)) {
    patch.terrain = terrain;
    sent.terrain = [...terrain];
  }
  if (!sameFields(sent.roads, roads)) {
    patch.roads = roads;
    sent.roads = { ...roads };
  }
  if (!sameList(sent.revealed, revealed)) {
    patch.revealed = revealed;
    sent.revealed = [...revealed];
  }
  if (!sameList(sent.reserve, reserve)) {
    patch.reserve = reserve;
    sent.reserve = [...reserve];
  }
  if (!sameFieldTiles(sent.fields, fields)) {
    patch.fields = fields;
    sent.fields = copyFields(fields);
  }
  const groundTiles = groundTilesOf(state);
  if (!sameGroundTiles(sent.groundTiles, groundTiles)) {
    patch.groundTiles = groundTiles;
    sent.groundTiles = copyGroundTiles(groundTiles);
  }
  for (const key in sent.mapObject) {
    const id = Number(key);
    if (mapObject[id] !== undefined) continue;
    patch.removed.push(id);
    delete sent.mapObject[id];
    delete sent.mapObjectTile[id];
  }
  for (const key in mapObject) {
    const id = Number(key);
    const obj = mapObject[id] as MapObjectComponent;
    const at = tile[id];
    const was = sent.mapObject[id];
    const wasAt = sent.mapObjectTile[id];
    if (was && sameFields(was, obj) && wasAt?.x === at?.x && wasAt?.y === at?.y) continue;
    patch.mapObject[id] = obj;
    sent.mapObject[id] = { ...obj };
    if (at) {
      patch.mapObjectTile[id] = at;
      sent.mapObjectTile[id] = { ...at };
    }
  }
  sent.version = state.staticVersion;
  return patch;
}

/**
 * `layers` brought up to date by `patch`. Layers the patch leaves alone stay the same objects, so
 * a renderer can skip them by identity; changed ones are new objects.
 */
export function applyStaticPatch(layers: StaticLayers, patch: StaticPatch): StaticLayers {
  let { mapObject, mapObjectTile } = layers;
  if (Object.keys(patch.mapObject).length > 0 || patch.removed.length > 0) {
    mapObject = { ...mapObject, ...patch.mapObject };
    mapObjectTile = { ...mapObjectTile, ...patch.mapObjectTile };
    for (const id of patch.removed) {
      delete mapObject[id];
      delete mapObjectTile[id];
    }
  }
  return {
    version: patch.version,
    terrain: patch.terrain ?? layers.terrain,
    roads: patch.roads ?? layers.roads,
    revealed: patch.revealed ?? layers.revealed,
    reserve: patch.reserve ?? layers.reserve,
    fields: patch.fields ?? layers.fields,
    mapObject,
    mapObjectTile,
    groundTiles: patch.groundTiles ?? layers.groundTiles,
  };
}

/**
 * Everything in `state` but its static layers: a `GameState` whose terrain, Roads, Revealed tiles,
 * Reserve, Fields and map objects are empty, whose `tile` store leaves out the map objects' tiles and whose Hunting
 * grounds have no `tiles`. Shallow: it shares every other object with `state`, so post it or copy
 * it before `state` steps on.
 */
export function movingPart(state: GameState): GameState {
  const { mapObject, tile, huntingGround } = state.components;
  const movingTile: Store<Tile> = {};
  for (const key in tile) {
    const id = Number(key);
    if (mapObject[id] === undefined) movingTile[id] = tile[id] as Tile;
  }
  const movingGround: Store<HuntingGroundComponent> = {};
  for (const key in huntingGround) {
    const id = Number(key);
    movingGround[id] = { ...(huntingGround[id] as HuntingGroundComponent), tiles: [] };
  }
  return {
    ...state,
    map: { ...state.map, terrain: [], roads: {}, revealed: [], reserve: [], fields: {} },
    components: {
      ...state.components,
      mapObject: {},
      tile: movingTile,
      huntingGround: movingGround,
    },
  };
}

/** The whole state again, from a moving part and the latest static layers. */
export function joinSnapshot(moving: GameState, layers: StaticLayers): GameState {
  return {
    ...moving,
    map: {
      ...moving.map,
      terrain: layers.terrain,
      roads: layers.roads,
      revealed: layers.revealed,
      reserve: layers.reserve,
      fields: layers.fields,
    },
    components: {
      ...moving.components,
      mapObject: layers.mapObject,
      tile: { ...layers.mapObjectTile, ...moving.components.tile },
      huntingGround: joinGrounds(moving.components.huntingGround, layers.groundTiles),
    },
  };
}

/** The moving part's Hunting grounds with their tiles back from the static layers. */
function joinGrounds(
  grounds: Store<HuntingGroundComponent>,
  groundTiles: Store<number[]>,
): Store<HuntingGroundComponent> {
  const joined: Store<HuntingGroundComponent> = {};
  for (const key in grounds) {
    const id = Number(key);
    joined[id] = { ...(grounds[id] as HuntingGroundComponent), tiles: groundTiles[id] ?? [] };
  }
  return joined;
}
