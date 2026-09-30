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
/** The Monster rate a new game gets unless it's given one, and that saves made before it load as. */
export const DEFAULT_MONSTER_RATE = 100;

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
  /**
   * Fog: the tiles the player has seen at least once (`TileBits`). Kept while Fog is off, when
   * every tile counts as Revealed anyway (`fog.ts`). A static layer.
   */
  revealed: TileBits;
  /** Fog: the tiles in sight right now (`TileBits`); empty while Fog is off. */
  inSight: TileBits;
  /**
   * The Reserve (`TileBits`): tiles the player painted, where woodcutters fell nothing. A static
   * layer.
   */
  reserve: TileBits;
}

/**
 * One flag per tile, packed 32 to a number: tile index `i` is bit `i % 32` of number
 * `floor(i / 32)`. Numbers past the end count as 0. Read and set with `hasTile`/`setTile` (`fog.ts`).
 */
export type TileBits = number[];

/** A tree or other gatherable object standing on a tile. */
export interface MapObjectComponent {
  type: MapObjectId;
  amount: number;
  /**
   * Forage patches only: Withered, no standing tree shades it. Worked out when the map is made
   * and kept up to date when a tree near it is felled (`refreshShade`). Absent on other objects.
   */
  withered?: boolean;
  /**
   * Something growing only (a Sapling): the tick from which it grows into the next thing, which
   * happens at the first Dawn at or after it (`systems/growth.ts`). Absent on other objects.
   */
  growsAt?: number;
  /** Something growing with drawing stages (a Sapling): the stage it's drawn at, from 0. */
  stage?: number;
}

/**
 * Quarter turns clockwise from the layout content gives a building (its `size` and `door`):
 * 0 is that layout, and a door on the south side faces west at 1, north at 2 and east at 3.
 */
export type Rotation = 0 | 1 | 2 | 3;

export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

export function isRotation(value: unknown): value is Rotation {
  return ROTATIONS.includes(value as Rotation);
}

export interface BuildingComponent {
  type: BuildingId;
  /** Quarter turns from the content layout. */
  rotation: Rotation;
  /** Output buffer contents, the Food a Granary holds, or a House's or a light's fuel. */
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
  /** A light (torch, brazier) that burned its fuel at tonight's Dusk: lit until Dawn. */
  lit: boolean;
  /**
   * Hit points of a building Gloamlings batter: a wall's (`WallDef.hp`), whole. Null for a
   * building they don't.
   */
  hp: number | null;
}

export interface SiteComponent {
  /** The building this site turns into. */
  type: BuildingId;
  /** Quarter turns from the content layout; the building keeps it. */
  rotation: Rotation;
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
 * Home after that. `asleep`: at Home, or where it stood when Homeless, until Dawn. A Watchman
 * (`watchtowers.ts`) works nights: after its Meal it's `toTower`, walking to its watchtower, then
 * `onWatch` in it until Dawn; by day it's `goingHome`, then `asleep` at Home until Dusk.
 */
export type Routine = 'work' | 'toGranary' | 'goingHome' | 'asleep' | 'toTower' | 'onWatch';

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
  /** Ticks slept at Home since the last Dusk (a Watchman's: since the last Dawn). */
  sleptTicks: number;
  /**
   * Slept too little at Home last night: slower until the next Dusk. A Watchman: slept too little
   * at Home by day, slower until the next Dawn.
   */
  tired: boolean;
  /** Meals missed in a row. Hungry at 1 or more: slower until it eats. */
  missedMeals: number;
  /** Cold nights in a row (a cold season's night in a cold House or in the open). Cold at 1 or more. */
  coldNights: number;
  /** Hit points, whole. Back to full at Dawn; it dies at 0 (`systems/combat.ts`). */
  hp: number;
  /** First tick it can hit again. */
  readyAt: number;
  /**
   * A Gloamling going for it is in reach: it has dropped its work and stands its ground, hitting
   * back, until none is. Its `routine` carries on from there afterwards.
   */
  fighting: boolean;
  /**
   * Called to arms by the Militia bell (`militia.ts`): it has dropped its work and walks to the
   * bell or fights Gloamlings near it, until the bell is rung again or Dawn. Its `routine` waits.
   */
  militia: boolean;
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
  /** Hit points, whole. Back to full at Dawn and when it gets up; Knocked out at 0. */
  hp: number;
  /** First tick it can hit again. */
  readyAt: number;
  /**
   * While Knocked out, the tick it gets up at full HP; null when it's up. Knocked out, it takes no
   * orders, has no aura, and Gloamlings ignore it.
   */
  knockedOutUntil: number | null;
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
  /**
   * Take goods carriers haven't claimed from a building's output buffer, a stockpile tile or a
   * cache.
   */
  | { kind: 'pickup'; source: EntityId; resource: ResourceId; tile: number }
  /** Go after `gloamling`, following it as it moves, and hit it first while it's in reach. */
  | { kind: 'attack'; gloamling: EntityId }
  /** Walk up to `den` and hit it until it's cleared. */
  | { kind: 'attackDen'; den: EntityId };

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

/** A forester: walks to an empty tile in its lodge's radius and plants a Sapling there. */
export type ForesterTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'toPlot'; plot: Tile }
  | { kind: 'planting'; plot: Tile; ticksLeft: number };

/** A hunter: walks into a Hunting ground in its lodge's radius, hunts, and brings back its bag. */
export type HunterTask =
  | { kind: 'idle'; retryAt: number }
  | { kind: 'toGround'; ground: EntityId }
  | { kind: 'hunting'; ground: EntityId; ticksLeft: number }
  /** Walking back to the lodge; `bag` is the catch, empty after a miss. */
  | { kind: 'toLodge'; bag: ResourceAmount[] };

/**
 * A Hunting ground: a set of Forest tiles holding Game. Its ceiling follows the trees standing on
 * its tiles (`groundCeiling`); Game above the ceiling flees when a tree on it is felled. Below the
 * ceiling Game recovers; hunted to 0, the ground stays empty a while (`regrowsOn`).
 */
export interface HuntingGroundComponent {
  name: string;
  /** Its tiles, as tile indices (row-major), ascending and each once. Fixed once the map stands. */
  tiles: number[];
  maxGame: number;
  game: number;
  /** Trees standing in it when the map started. */
  startTrees: number;
  /** Animals that fled because of logging, all game long. */
  fled: number;
  /**
   * The day at whose Dawn Game next comes back: while empty, when the returning animals come;
   * while under the ceiling, when the next animal does; null when nothing is due.
   */
  regrowsOn: number | null;
}

/**
 * A monster Den, standing on its `tile`. It spawns Gloamlings at Dusk and buds new Dens (see
 * `systems/dens.ts`). It isn't a `mapObject`: nobody gathers it, and it doesn't block walking.
 * The Hero can attack it; it stings back, and at 0 HP it's cleared (`dens.ts` `clearDen`).
 */
export interface DenComponent {
  /** Hit points, whole. It never heals. */
  hp: number;
  /** First tick it can sting again. */
  readyAt: number;
}

/**
 * The goods a cleared Den leaves, loose on its `tile`: Carriers and the Hero pick them up like a
 * building's output. Gone once empty.
 */
export interface CacheComponent {
  stock: ResourceAmounts;
}

/** Around a cleared Den: no Den buds within `calmTiles` of `tile` until tick `until`. */
export interface CalmArea {
  tile: Tile;
  until: number;
}

/** A Gloamling, the night monster: out from Dusk until Dawn, at its `position`. */
export interface GloamlingComponent {
  /** The Den it came out of. */
  den: EntityId;
  /** Hit points, whole. It's gone at 0. */
  hp: number;
  /** First tick it can hit again. */
  readyAt: number;
  /**
   * What it's going for: a villager out in the open, the Hero, or (with neither in sight) a
   * lived-in House, whose door it walks to. Null with nothing to go for.
   */
  target: EntityId | null;
}

export interface Components {
  /** Anchor tile of static things: map objects, Dens, buildings, construction sites, stockpiles. */
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
  forester: Store<ForesterTask>;
  huntingGround: Store<HuntingGroundComponent>;
  den: Store<DenComponent>;
  gloamling: Store<GloamlingComponent>;
  cache: Store<CacheComponent>;
}

/** How a villager died. */
export type DeathCause = 'starvation' | 'freezing' | 'gloamling' | 'den';

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
  /**
   * Goes up whenever what blocks walking, road speed or Light changes (`mapChanged`). Derived
   * data about the map, such as walk grids, is cached until it moves on.
   */
  mapVersion: number;
  /**
   * Goes up whenever a static layer changes (`staticChanged`): terrain, Roads, or any map object
   * (added, removed, its `amount` or `withered`). The client is sent those layers only when it
   * moves on (`snapshot.ts`).
   */
  staticVersion: number;
  map: MapState;
  components: Components;
  logistics: LogisticsState;
  /** Every villager who has died, oldest first. */
  deaths: Death[];
  /** Set when the last villager dies (the hero alone doesn't count); null while the game runs. */
  gameOver: GameOver | null;
  /** Carrier and road counts over the last in-game day, oldest slice first. */
  traffic: TrafficSlice[];
  /**
   * How many monsters come out, as a percent (0–100) of the Dens' full spawns. 0 turns nights
   * off: no spawns, no budding, and Gloamlings out vanish at once.
   */
  monsterRate: number;
  /**
   * Fog on or off for this game (`fog.ts`). Off means every tile counts as Revealed and In sight.
   * It changes only what the player sees and where they may build.
   */
  fog: boolean;
  /** One per Den cleared in the last `calmDays` days, oldest first; dropped at the Dawn it ends. */
  calms: CalmArea[];
}
