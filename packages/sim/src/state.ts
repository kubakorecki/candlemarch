// The game state: plain, JSON-serializable data. See CLAUDE.md "Simulation rules".
import type {
  BuildingId,
  HeroId,
  JobId,
  MapObjectId,
  RecipeId,
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
  /** Tile on the map's edge where Newcomers arrive, or null on a map nobody immigrates to. */
  entry: Tile | null;
}

/** A tree or other gatherable object standing on a tile. */
export interface MapObjectComponent {
  type: MapObjectId;
  amount: number;
}

export interface BuildingComponent {
  type: BuildingId;
  /** Output buffer contents, the Food a Granary holds, or a House's fuel. */
  stock: ResourceAmounts;
  /** Input buffer contents. Empty unless the building is a workshop. */
  input: ResourceAmounts;
  /**
   * Most workers staffing fills it up to, from 0 to every position it has (`maxWorkers`). The
   * player sets it; it starts at the maximum.
   */
  workerLimit: number;
  /**
   * A House that couldn't burn fuel at a cold season's Dusk, or wasn't lived in then: cold until
   * Dawn. Always false otherwise.
   */
  cold: boolean;
}

export interface SiteComponent {
  /** The building this site turns into. */
  type: BuildingId;
  delivered: ResourceAmounts;
  /** Ticks of building done so far. Advances only by day, once every cost is delivered. */
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

/**
 * Where a villager is in its day. `work`: doing its Job (after Dusk, only finishing what it
 * holds). `toGranary`: walking to a Granary for its Meal after Dusk. `goingHome`: walking to its
 * Home after that. `asleep`: at Home, or where it stood when Homeless, until Dawn.
 */
export type Routine = 'work' | 'toGranary' | 'goingHome' | 'asleep';

export interface VillagerComponent {
  /** First name, drawn from content's pool on arrival. Not unique once the pool runs out. */
  name: string;
  job: JobId;
  /** Building the villager works for, if any. */
  workplace: EntityId | null;
  carrying: ResourceAmount | null;
  /** The House the villager lives in, or null when Homeless. */
  home: EntityId | null;
  routine: Routine;
  /** Ticks slept at Home since the last Dusk. */
  sleptTicks: number;
  /** Slept too little at Home last night: slower until the next Dusk. */
  tired: boolean;
  /** Meals missed in a row. Hungry at 1 or more: slower until it eats. */
  missedMeals: number;
  /** Cold nights in a row (a cold season's night in a cold House or in the open). Cold at 1 or more. */
  coldNights: number;
}

/**
 * The hero the player controls (one per game). Not a villager: it has no Job and walks only
 * where it's ordered. It has a `position`, and a `path` while walking.
 */
export interface HeroComponent {
  type: HeroId;
  /** Goods in the hero's hands. */
  carrying: ResourceAmount | null;
  /** The order being carried out, or null when idle or just walking somewhere. */
  order: HeroTask | null;
}

/**
 * What the hero is doing for its current order. Deliveries and pickups walk to `tile` (a door or
 * a stockpile tile) first.
 */
export type HeroTask =
  /** Chop `tree` until it's gone or the hero's hands are full; `ticksLeft` of the current chop. */
  | { kind: 'gather'; tree: EntityId; ticksLeft: number }
  /**
   * Put down goods at a site, workshop or stockpile. For a site or workshop, `amount` is what the
   * hero promised it, counted as incoming from the moment of the order so carriers don't bring the
   * same goods; for a stockpile it's what the hero set out with, and nothing is reserved.
   */
  | { kind: 'deliver'; target: EntityId; resource: ResourceId; tile: number; amount: number }
  /** Take goods carriers haven't claimed from a building's output buffer or a stockpile tile. */
  | { kind: 'pickup'; source: EntityId; resource: ResourceId; tile: number };

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

/** A workshop worker: waits at its Workplace's door and works through its recipes there. */
export type CrafterTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'working'; recipe: RecipeId; ticksLeft: number };

/** A fisher: waits at its Workplace's door, on the riverbank, and fishes there. */
export type FisherTask = { kind: 'idle'; retryAt: number } | { kind: 'fishing'; ticksLeft: number };

/** A forager: walks to a forage patch in its hut's radius, gathers, and brings the Food back. */
export type ForagerTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'toPatch'; patch: EntityId }
  | { kind: 'gathering'; patch: EntityId; ticksLeft: number }
  | { kind: 'toHut' };

/** A hunter: walks into a Hunting ground in its lodge's radius, hunts, and brings back its bag. */
export type HunterTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'toGround'; ground: EntityId }
  | { kind: 'hunting'; ground: EntityId; ticksLeft: number }
  /** Walking back to the lodge; `bag` is the catch, empty after a miss. */
  | { kind: 'toLodge'; bag: ResourceAmount[] };

/**
 * A Hunting ground: a rectangle of forest holding Game. Its ceiling follows the forest standing in
 * it (`groundCeiling`); Game above the ceiling flees when a tree in it is felled.
 */
export interface HuntingGroundComponent {
  name: string;
  /** The rectangle, in tiles: origin (smallest x and y) and size. */
  x: number;
  y: number;
  w: number;
  h: number;
  maxGame: number;
  game: number;
  /** Trees standing in it when the map started. */
  startTrees: number;
  /** Animals that fled because of logging, all game long. */
  fled: number;
}

export interface Components {
  /** Anchor tile of static things: map objects, buildings, construction sites, stockpiles. */
  tile: Store<Tile>;
  mapObject: Store<MapObjectComponent>;
  building: Store<BuildingComponent>;
  site: Store<SiteComponent>;
  stockpile: Store<StockpileComponent>;
  villager: Store<VillagerComponent>;
  hero: Store<HeroComponent>;
  position: Store<Point>;
  path: Store<PathComponent>;
  woodcutter: Store<WoodcutterTask>;
  crafter: Store<CrafterTask>;
  fisher: Store<FisherTask>;
  forager: Store<ForagerTask>;
  hunter: Store<HunterTask>;
  huntingGround: Store<HuntingGroundComponent>;
}

/** How a villager died. */
export type DeathCause = 'starvation' | 'freezing';

/** A villager's death, kept for the message log and alerts. */
export interface Death {
  name: string;
  cause: DeathCause;
  /** The day it died, counting from 1. */
  day: number;
}

/**
 * Counts for one slice of the last in-game day (`traffic.ts`): Carrier utilization and road
 * traffic are summed over the slices in the window.
 */
export interface TrafficSlice {
  /** Which slice of time it counts: `floor(tick / slice length)`. */
  slice: number;
  /** Ticks Carriers spent at work (routine `work`), one per Carrier per tick. */
  carrierTicks: number;
  /** Of those, ticks spent holding a Haul. */
  haulTicks: number;
  /** Carrier steps onto each Road tile, by tile index. Tiles nobody stepped onto are absent. */
  roadSteps: Record<number, number>;
}

/** How the game ended: the day and cause of the last villager's death. */
export interface GameOver {
  day: number;
  cause: DeathCause;
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
  /** Every villager who has died, oldest first. */
  deaths: Death[];
  /** Set when the last villager dies (the hero alone doesn't count); null while the game runs. */
  gameOver: GameOver | null;
  /** Carrier and road counts over the last in-game day, oldest slice first. */
  traffic: TrafficSlice[];
}
