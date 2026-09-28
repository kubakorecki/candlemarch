// ID unions and definition shapes. IDs are string literal unions so a typo is a type error.

export type ResourceId = 'logs' | 'firewood' | 'fish' | 'berries' | 'mushrooms' | 'meat' | 'hides';
export type RecipeId = 'split_logs';
export type TerrainId = 'grass' | 'river';
export type MapObjectId = 'tree' | 'berry_bush' | 'mushroom_patch';
export type BuildingId =
  | 'woodcutters_hut'
  | 'hut'
  | 'chopping_block'
  | 'fishers_hut'
  | 'foragers_hut'
  | 'hunters_lodge'
  | 'granary'
  | 'torch'
  | 'brazier'
  | 'bell'
  | 'watchtower'
  | 'palisade'
  | 'gate';
export type JobId =
  | 'woodcutter'
  | 'carrier'
  | 'woodsplitter'
  | 'fisher'
  | 'forager'
  | 'hunter'
  | 'watchman';
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

/** A resource. Food (stored in a Granary) spoils; other goods keep. */
export type ResourceDef = GoodsDef | FoodDef;

interface ResourceBase {
  id: ResourceId;
  name: string;
}

/** Bulk goods, kept on Stockpiles. */
export interface GoodsDef extends ResourceBase {
  storage: 'stockpile';
}

/** Food, kept in a Granary and eaten as Meals. */
export interface FoodDef extends ResourceBase {
  storage: 'granary';
  /**
   * Share of each stack lost at every Dawn, as a percent, rounded up per stack (ADR-0002). The
   * season scales it (`SeasonDef.spoilPercent`).
   */
  spoilPercent: number;
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

/** Something standing on a tile that blocks it, such as a tree or a forage patch. */
export interface MapObjectDef {
  id: MapObjectId;
  name: string;
  /** What gathering it yields. */
  resource: ResourceId;
  /** How many units it holds when the map starts. It is removed once empty, unless it forages. */
  amount: number;
  /** Ticks of work for one gather. */
  gatherTicks: number;
  /** Units taken per gather. */
  yieldPerGather: number;
  /** Makes it a forage patch: it stays when empty and refills each season while shaded. */
  forage?: ForageDef;
}

/**
 * A forage patch's seasons. At the start of each season its stock is set to that season's amount
 * while a `shadedBy` object stands within `shadeTiles` (Chebyshev distance); without shade it
 * withers, and is set to nothing.
 */
export interface ForageDef {
  stock: Record<SeasonId, number>;
  shadedBy: MapObjectId;
  shadeTiles: number;
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

/** A hero the player controls. Not a villager: has no Job and can't die. Fights with `combat.hero`. */
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
  /** Every Food's spoil rate this season, as a percent of its own: winter's cold keeps food. */
  spoilPercent: number;
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
  /**
   * A Meal is `mealUnits` of Food. A villager who missed their last Meal is Hungry: walks and
   * works at `speedPercent`. After `starveAfterMissedMeals` missed Meals in a row they starve.
   */
  hungry: { mealUnits: number; speedPercent: number; starveAfterMissedMeals: number };
  /**
   * Warmth. Each House keeps up to `houseBuffer` of `fuel` and asks for it in `stockUpSeasons`.
   * At each Dusk of a `coldSeasons` season an occupied House burns `burnPerNight`; one that can't
   * is cold that night. A night there in a cold House or in the open is a cold night: Cold at 1
   * or more in a row (walks and works at `speedPercent`), freezes to death at
   * `freezeAfterColdNights`. A warm night resets the count.
   */
  cold: {
    fuel: ResourceId;
    houseBuffer: number;
    burnPerNight: number;
    stockUpSeasons: SeasonId[];
    coldSeasons: SeasonId[];
    speedPercent: number;
    freezeAfterColdNights: number;
  };
}

/**
 * Immigration, checked at each Dawn: one Newcomer arrives when a House has a free place, the
 * Granaries hold at least `mealsPerHead` Meals for each villager plus the Newcomer, and the season
 * isn't one of `closedSeasons` (roads snowed in).
 */
export interface ImmigrationDef {
  mealsPerHead: number;
  closedSeasons: SeasonId[];
}

/** Thresholds for the HUD's death-spiral alerts. */
export interface AlertsDef {
  /** "About N days of Food left" shows when the Granaries hold Meals for fewer days than this. */
  lowFoodDays: number;
}

/**
 * Monster Dens (M3). At each Dusk a Den spawns `spawnsPerDusk` Gloamlings for the season, scaled by
 * the game's Monster rate. At the start of each season each Den buds a new Den closer to the
 * village. Nothing can be built within `darkRingTiles` of a Den (Chebyshev distance).
 */
export interface DensDef {
  spawnsPerDusk: Record<SeasonId, number>;
  darkRingTiles: number;
  budding: {
    /**
     * A bud stands `closerMin`–`closerMax` tiles closer to the nearest building than its Den
     * (Chebyshev distance to a footprint), and at most `closerMax` tiles from its Den.
     */
    closerMin: number;
    closerMax: number;
    /** A bud stands at least this far from every building and construction site. */
    minBuildingTiles: number;
    /** No Den buds while the map holds this many. */
    maxDens: number;
  };
}

/**
 * A fighter's numbers (M3 combat): whole HP, damage a hit, ticks between hits, and reach in tiles
 * (Chebyshev distance between the tiles they stand on; 1 is an adjacent tile).
 */
export interface FighterDef {
  hp: number;
  damage: number;
  cooldownTicks: number;
  reachTiles: number;
}

/** Auto-resolved night combat (M3). */
export interface CombatDef {
  /** The night monster. It walks at `walkSpeed` (milli-tiles per tick) and sees `sightTiles` far. */
  gloamling: FighterDef & { walkSpeed: number; sightTiles: number };
  /** Every villager, whatever its Job. Back to full HP at Dawn. */
  villager: FighterDef;
  /**
   * The Hero. At 0 HP it's Knocked out where it falls for `knockoutTicks`, then gets up at full HP.
   * Back to full HP at Dawn.
   */
  hero: FighterDef & { knockoutTicks: number };
  /**
   * HP of every House's door, which Gloamlings batter; a broken door costs one resident. Back to
   * full at Dawn.
   */
  houseDoorHp: number;
}

/** Hunting grounds: forest regions holding Game, which logging drives away. */
export interface HuntingDef {
  /** The map object a ground's forest is made of: felling one lowers the ground's ceiling. */
  forest: MapObjectId;
  /** Catch chance, in permille, from a ground at its max Game; it falls in step with the Game. */
  maxCatchPermille: number;
  /**
   * Health words, by Game as a percent of max Game: Thriving at `thrivingPercent` or more,
   * Scarce under `scarcePercent` (but not empty), Thinning between.
   */
  thrivingPercent: number;
  scarcePercent: number;
}

/**
 * A light (torch, brazier). It keeps up to `holds` of `fuel` in its stock, which Carriers fill
 * every season. At each Dusk it burns `burnPerNight`; one that can't stays dark all night. Lit, it
 * casts Light on every tile within `radiusTiles` of its footprint (Chebyshev distance), and
 * Gloamlings never step onto a lit tile (ADR-0003).
 */
export interface LightDef {
  radiusTiles: number;
  fuel: ResourceId;
  burnPerNight: number;
  holds: number;
}

/**
 * The Militia bell. Ringing it calls every villager but Watchmen to arms: they drop their work,
 * walk to the bell and fight Gloamlings within `rangeTiles` of it (Chebyshev distance), until it's
 * rung again or Dawn comes.
 */
export interface BellDef {
  rangeTiles: number;
}

/**
 * A watchtower (M3). While its Watchman stands in it (the night shift), it shoots the nearest
 * Gloamling within `rangeTiles` of its tile (Chebyshev distance, ties to the lowest ID) for
 * `damage`, once every `cooldownTicks`. Gloamlings can't attack it.
 */
export interface WatchDef {
  rangeTiles: number;
  damage: number;
  cooldownTicks: number;
}

/**
 * A wall segment (M3): a 1×1 building laid by dragging like a Road. A palisade blocks villagers
 * and Gloamlings alike; a Gate lets villagers and the Hero through, but not Gloamlings. Its site
 * doesn't block anyone until it's built. `hp` is what Gloamlings batter; it heals at Dawn.
 */
export interface WallDef {
  hp: number;
  /** Makes it a Gate. */
  gate: boolean;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** Footprint in tiles, anchored at the building's origin tile (its smallest x and y). */
  size: { w: number; h: number };
  /**
   * Tile villagers walk to when they visit the building, as an offset from the origin. Lies
   * outside the footprint, except a wall's: its own tile, where villagers deliver to its site.
   */
  door: { x: number; y: number };
  /** The player can place it. Buildings that aren't placeable only come with the map. */
  placeable: boolean;
  /** Villagers the building employs when it exists. */
  employs: { job: JobId; count: number }[];
  /** Map objects its workers gather from, if any. */
  gathers?: MapObjectId[];
  /**
   * Its workers gather only within this many tiles of its footprint (Chebyshev distance). Without
   * it they go anywhere.
   */
  workRadius?: number;
  /**
   * Its workers fish at its door, putting each catch in the output buffer. Fish never run out;
   * fishing stops while the river is frozen.
   */
  fishes?: { catchTicks: number; yieldPerCatch: number };
  /**
   * Its workers hunt in Hunting grounds within its work radius: each hunt takes `huntTicks` and,
   * if the roll succeeds, brings `catch` back to the output buffer.
   */
  hunts?: { huntTicks: number; catch: ResourceAmount[] };
  /** Its door must be on a riverbank tile. */
  doorOnRiverbank?: boolean;
  /** Where its workers drop what they produce, if anything: a capacity per resource. */
  outputBuffer?: { resource: ResourceId; capacity: number }[];
  /** Recipes its workers work through, in order of preference. Makes the building a workshop. */
  recipes?: RecipeId[];
  /** What a workshop holds of each of its recipes' inputs. Carriers fill it. */
  inputBuffer?: { resource: ResourceId; capacity: number }[];
  /**
   * A workshop pauses while the village holds at least this much of the resource: it starts no
   * new work and asks for no inputs.
   */
  stockTarget?: ResourceAmount;
  /** Units of Food it stores, all Foods together: a building with it is a Granary. */
  foodCapacity?: number;
  /** Villagers it houses: a building with residents is a House. */
  residents?: number;
  /** Makes it a light (M3): a building that burns fuel each night to cast Light. */
  light?: LightDef;
  /** Makes it the Militia bell (M3). */
  bell?: BellDef;
  /** Makes it a watchtower (M3): its worker, a Watchman, works the night shift in it. */
  watch?: WatchDef;
  /** Makes it a wall segment (M3): a palisade or a Gate. */
  wall?: WallDef;
  /** A village has at most one, built or under construction. */
  onePerVillage?: boolean;
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
  hunting: HuntingDef;
  immigration: ImmigrationDef;
  alerts: AlertsDef;
  dens: DensDef;
  combat: CombatDef;
  /** First names new villagers are drawn from. */
  villagerNames: readonly string[];
}
