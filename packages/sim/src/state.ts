// The game state: plain, JSON-serializable data. See CLAUDE.md "Simulation rules".
import type {
  BuildingId,
  JobId,
  MapObjectId,
  ResourceAmount,
  ResourceId,
  RoadId,
  TerrainId,
} from '@candlemarch/content';
import type { LogisticsState } from './logistics/jobDispatch';

export const STATE_VERSION = 4;
export const TICKS_PER_SECOND = 20;
/** Sub-tile units per tile. Positions are integers in these units. */
export const TILE_UNITS = 1000;
/** Length of a diagonal step between tile centres, in sub-tile units (1000 × √2, rounded). */
export const DIAGONAL_UNITS = 1414;

export type EntityId = number;
/** A component store: component data keyed by entity ID. */
export type Store<T> = Record<EntityId, T>;
export type ResourceAmounts = Partial<Record<ResourceId, number>>;

/** A tile coordinate. */
export interface Tile {
  x: number;
  y: number;
}

/** A position in sub-tile units. The centre of tile (x, y) is (x × 1000 + 500, y × 1000 + 500). */
export interface Point {
  x: number;
  y: number;
}

export interface MapState {
  width: number;
  height: number;
  /** Terrain per tile, row-major: index = y × width + x. */
  terrain: TerrainId[];
  /** Road on each tile that has one, keyed by tile index. Tiles without a road are absent. */
  roads: Record<number, RoadId>;
}

/** A tree or other gatherable object standing on a tile. */
export interface MapObjectComponent {
  type: MapObjectId;
  amount: number;
}

export interface BuildingComponent {
  type: BuildingId;
  /** Output buffer contents. */
  stock: ResourceAmounts;
}

export interface SiteComponent {
  /** The building this site turns into. */
  type: BuildingId;
  delivered: ResourceAmounts;
  /** Ticks of building done so far. Advances only once every cost is delivered. */
  buildProgress: number;
}

/** Stockpiles of higher priority are filled first, whatever the distance. */
export type StockpilePriority = 'low' | 'normal' | 'high';

/** An open-air store of goods covering a rectangle of tiles. */
export interface StockpileComponent {
  /** Size in tiles. The entity's `tile` is its origin (smallest x and y). */
  size: { w: number; h: number };
  priority: StockpilePriority;
  /** Resources it takes no more of. Goods already on it stay. */
  refuses: ResourceId[];
  /** Goods on each tile that holds any, keyed by map tile index. Empty tiles are absent. */
  goods: Record<number, ResourceAmount>;
}

export interface VillagerComponent {
  job: JobId;
  /** Building the villager works for, if any. */
  workplace: EntityId | null;
  carrying: ResourceAmount | null;
}

/** A walk in progress along tile centres. Removed on arrival. */
export interface PathComponent {
  /** Tile index the walk started from. */
  start: number;
  /** Tile indices to visit, in order; the last one is the destination. */
  tiles: number[];
  /** Index into `tiles` of the tile currently being walked towards. */
  next: number;
  /** Units already walked on the current segment. */
  progress: number;
}

export type WoodcutterTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'toTree'; tree: EntityId }
  | { kind: 'chopping'; tree: EntityId; ticksLeft: number }
  | { kind: 'toHut' };

export interface Components {
  /** Anchor tile of static things: map objects, buildings, construction sites, stockpiles. */
  tile: Store<Tile>;
  mapObject: Store<MapObjectComponent>;
  building: Store<BuildingComponent>;
  site: Store<SiteComponent>;
  stockpile: Store<StockpileComponent>;
  villager: Store<VillagerComponent>;
  position: Store<Point>;
  path: Store<PathComponent>;
  woodcutter: Store<WoodcutterTask>;
}

export interface GameState {
  version: typeof STATE_VERSION;
  tick: number;
  /** mulberry32 PRNG state. */
  rng: number;
  nextId: EntityId;
  map: MapState;
  components: Components;
  logistics: LogisticsState;
}
