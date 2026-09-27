// ID unions and definition shapes. IDs are string literal unions so a typo is a type error.

export type ResourceId = 'logs' | 'firewood' | 'fish';
export type RecipeId = 'split_logs';
export type TerrainId = 'grass' | 'river';
export type MapObjectId = 'tree';
export type BuildingId = 'woodcutters_hut' | 'hut' | 'chopping_block' | 'fishers_hut';
export type JobId = 'woodcutter' | 'carrier' | 'woodsplitter' | 'fisher';
export type RoadId = 'dirt_path';
export type HeroId = 'placeholder';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

/** A number of units of one resource. */
export interface ResourceAmount {
  resource: ResourceId;
  amount: number;
}

/**
 * Where the village stores a resource: on Stockpiles (bulk goods), or in a Granary (Food, which
 * never goes to a Stockpile). More stores come later.
 */
export type ResourceStorage = 'stockpile' | 'granary';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  storage: ResourceStorage;
}

export interface TerrainDef {
  id: TerrainId;
  name: string;
  /** Villagers may walk across it. */
  walkable: boolean;
  /** Buildings may be placed on it. */
  buildable: boolean;
}

/** Work that turns inputs into outputs at a workshop. */
export interface RecipeDef {
  id: RecipeId;
  name: string;
  /** Taken from the workshop's input buffer when the work starts. */
  inputs: ResourceAmount[];
  /** Put in the workshop's output buffer when the work is done. */
  outputs: ResourceAmount[];
  /** Ticks of work for one batch, before the hero's aura. */
  workTicks: number;
}

/** Something standing on a tile that blocks it, such as a tree. */
export interface MapObjectDef {
  id: MapObjectId;
  name: string;
  /** What gathering it yields. */
  resource: ResourceId;
  /** How many units it holds when the map starts. It is removed once empty. */
  amount: number;
  /** Ticks of work for one gather. */
  gatherTicks: number;
  /** Units taken per gather. */
  yieldPerGather: number;
}

export interface JobDef {
  id: JobId;
  name: string;
  /** Walking speed in milli-tiles per tick (1000 = one tile per tick). */
  walkSpeed: number;
  /** Units carried per trip. */
  carryCapacity: number;
  /** Ticks to wait before looking for work again when none was found. */
  idleRetryTicks: number;
}

/** A hero the player controls. Not a villager: has no Job and can't die. */
export interface HeroDef {
  id: HeroId;
  name: string;
  /** Walking speed in milli-tiles per tick (1000 = one tile per tick). */
  walkSpeed: number;
  /** Units carried by hand at once. */
  carryCapacity: number;
  /**
   * Production bonus: Workplaces with a footprint tile within `radiusTiles` of the hero work at
   * `speedPercent` of their normal speed.
   */
  aura: { radiusTiles: number; speedPercent: number };
}

export interface RoadDef {
  id: RoadId;
  name: string;
  /** Walking speed on it, as a percentage of off-road speed (100 = no bonus). */
  speedPercent: number;
}

/** Logistics numbers. */
export interface LogisticsDef {
  /** Units one stockpile tile holds. */
  stockpileTileCapacity: number;
}

export interface SeasonDef {
  id: SeasonId;
  name: string;
  /** Ticks of night at the end of each of its days, from Dusk to the next Dawn. */
  nightTicks: number;
  /** The river is frozen all season: no fishing. */
  riverFrozen: boolean;
}

/** Days, nights and seasons. A day runs from Dawn to Dawn; night is its last `nightTicks`. */
export interface CalendarDef {
  /** Ticks from one Dawn to the next. */
  dayTicks: number;
  daysPerSeason: number;
  /** Seasons in the order they come in a year. A new game starts on the first one's day 1. */
  seasons: SeasonDef[];
}

/** What villagers need, and what missing it does to them. Each slowdown is a speed percent. */
export interface NeedsDef {
  /**
   * A villager who slept less than `minSleepPercent` of the night at Home walks and works at
   * `speedPercent` until the next Dusk.
   */
  tired: { minSleepPercent: number; speedPercent: number };
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** Footprint in tiles, anchored at the building's origin tile (its smallest x and y). */
  size: { w: number; h: number };
  /** Tile villagers walk to when they visit the building, as an offset from the origin. Lies outside the footprint. */
  door: { x: number; y: number };
  /** The player can place it. Buildings that aren't placeable only come with the map. */
  placeable: boolean;
  /** Villagers the building employs when it exists. */
  employs: { job: JobId; count: number }[];
  /** Map object its workers gather from, if any. */
  gathers?: MapObjectId;
  /**
   * Its workers fish at its door, putting each catch in the output buffer. Fish never run out;
   * fishing stops while the river is frozen.
   */
  fishes?: { catchTicks: number; yieldPerCatch: number };
  /** Its door must be on a riverbank tile. */
  doorOnRiverbank?: boolean;
  /** Where its workers drop what they produce, if anything. */
  outputBuffer?: { resource: ResourceId; capacity: number };
  /** Recipes its workers work through, in order of preference. Makes the building a workshop. */
  recipes?: RecipeId[];
  /** What a workshop holds of each of its recipes' inputs. Carriers fill it. */
  inputBuffer?: { resource: ResourceId; capacity: number }[];
  /**
   * A workshop pauses while the village holds at least this much of the resource: it starts no
   * new work and asks for no inputs.
   */
  stockTarget?: ResourceAmount;
  /** Villagers it houses: a building with residents is a House. */
  residents?: number;
  /** Cost and time to build it from a construction site. Absent for buildings that can't be built. */
  construction?: { cost: ResourceAmount[]; buildTicks: number };
}

export interface Content {
  resources: Record<ResourceId, ResourceDef>;
  terrain: Record<TerrainId, TerrainDef>;
  mapObjects: Record<MapObjectId, MapObjectDef>;
  jobs: Record<JobId, JobDef>;
  recipes: Record<RecipeId, RecipeDef>;
  buildings: Record<BuildingId, BuildingDef>;
  heroes: Record<HeroId, HeroDef>;
  roads: Record<RoadId, RoadDef>;
  logistics: LogisticsDef;
  calendar: CalendarDef;
  needs: NeedsDef;
  /** First names new villagers are drawn from. */
  villagerNames: readonly string[];
}
