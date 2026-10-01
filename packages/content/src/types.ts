// ID unions and definition shapes. IDs are string literal unions so a typo is a type error.

export type ResourceId =
  | 'logs'
  | 'firewood'
  | 'fish'
  | 'berries'
  | 'mushrooms'
  | 'meat'
  | 'hides'
  | 'stone'
  | 'clay'
  | 'iron_ore'
  | 'grain'
  | 'charcoal'
  | 'planks'
  | 'cut_stone'
  | 'bricks'
  | 'smoked_fish'
  | 'smoked_meat';
export type RecipeId =
  | 'split_logs'
  | 'burn_charcoal'
  | 'saw_planks'
  | 'dress_stone'
  | 'fire_bricks'
  | 'smoke_fish'
  | 'smoke_meat';
export type TerrainId = 'meadow' | 'rock' | 'mountain' | 'swamp' | 'river' | 'ford' | 'pass_snow';
export type MapObjectId =
  | 'tree'
  | 'berry_bush'
  | 'mushroom_patch'
  | 'stone_deposit'
  | 'clay_deposit'
  | 'iron_deposit'
  | 'sapling'
  | 'stump';
export type BuildingId =
  | 'drain'
  | 'pass_road'
  | 'woodcutters_hut'
  | 'hut'
  | 'chopping_block'
  | 'fishers_hut'
  | 'foragers_hut'
  | 'hunters_lodge'
  | 'foresters_lodge'
  | 'granary'
  | 'torch'
  | 'brazier'
  | 'bell'
  | 'watchtower'
  | 'palisade'
  | 'gate'
  | 'village_hall'
  | 'notice_board'
  | 'quarry'
  | 'clay_pit'
  | 'mine'
  | 'bog_iron_digger'
  | 'farm'
  | 'charcoal_kiln'
  | 'sawpit'
  | 'stonecutter'
  | 'brick_kiln'
  | 'smokehouse';
export type JobId =
  | 'woodcutter'
  | 'carrier'
  | 'woodsplitter'
  | 'fisher'
  | 'forager'
  | 'hunter'
  | 'forester'
  | 'watchman'
  | 'quarryman'
  | 'clay_digger'
  | 'miner'
  | 'bog_digger'
  | 'farmer'
  | 'charcoal_burner'
  | 'sawyer'
  | 'stonecutter'
  | 'brickmaker'
  | 'smoker';
export type RoadId = 'dirt_path' | 'pass_road';
export type HeroId = 'placeholder';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type PoiId = 'ruins' | 'abandoned_mine' | 'shrine';
/** What a farm grows on its Fields (spec, Resources: Farms and crops). */
export type CropId = 'grain';
/** The master trades (spec, Trades and masters). A trade's workshops name it (`BuildingDef.trade`). */
export type TradeId = 'carpenter' | 'mason' | 'butcher' | 'smith' | 'miller' | 'brewer' | 'baker';

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
  /**
   * The standing order a Workplace making it (as its first output) starts with: it pauses while the
   * village holds at least this many. Every resource a Workplace makes has one.
   */
  standingOrder?: number;
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
  /** Buildings, Stockpiles and paths may be placed on it. */
  buildable: boolean;
  /**
   * Walking speed on it off-road, as a percentage (100 = full speed). A Road's speed replaces it.
   * 0 where it isn't walkable: nobody steps on it.
   */
  speedPercent: number;
  /**
   * Where villagers can't walk it, the Hero still wades it at this percentage off-road (Pass
   * snow). Absent: the Hero walks it like everyone else.
   */
  heroSpeedPercent?: number;
  /**
   * Ore every tile of it holds (Swamp: bog iron), back up to the cap at the start of each spring.
   * A building whose `digsOre` names this terrain digs it.
   */
  ore?: TerrainOreDef;
}

/**
 * Ore a terrain's tiles hold: up to `cap` units of `resource` a tile, dug `yieldPerDig` at a time
 * in `digTicks` of work.
 */
export interface TerrainOreDef {
  resource: ResourceId;
  cap: number;
  digTicks: number;
  yieldPerDig: number;
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
  /**
   * How many units it holds when the map starts. It is removed once empty, unless it forages or is
   * a Deposit.
   */
  amount: number;
  /** Ticks of work for one gather. */
  gatherTicks: number;
  /** Units taken per gather. */
  yieldPerGather: number;
  /** Makes it a forage patch: it stays when empty and refills each season while shaded. */
  forage?: ForageDef;
  /**
   * Makes it a Deposit: it blocks walking, and stays on the map once dug out. Says where it may
   * stand and whether it refills.
   */
  deposit?: DepositDef;
  /**
   * Makes it something growing (a Sapling, or a Stump that will sprout one): nobody gathers it
   * (its `amount` is 0; a building may still dig it out, see `BuildingDef.digs`), it doesn't block walking, and a building, Road or Stockpile put on its
   * tile clears it. It turns into `into` after `days`.
   */
  grows?: GrowsDef;
  /**
   * Walkers (villagers, the Hero, Gloamlings) cross its tile at this percent of the ground's
   * speed instead of being blocked by it. Nothing can still be built, paved or piled there.
   * 1–100.
   */
  walkSpeedPercent?: number;
}

/**
 * How something growing grows: it turns into `into` at the first Dawn `days` days after it
 * appeared, drawn meanwhile in `stages` steps (0 up to `stages` − 1, evenly over the days).
 */
export interface GrowsDef {
  into: MapObjectId;
  days: number;
  stages: number;
}

/**
 * Where a Deposit may stand: on `terrain`, and with `edge`, only at an edge of it: `riverbank`
 * orthogonally next to a River tile, `face` orthogonally next to walkable terrain.
 */
export interface DepositDef {
  terrain: TerrainId;
  edge?: 'riverbank' | 'face';
  /**
   * At the start of each spring it regains this percent of its starting `amount`, up to that
   * amount, even once dug out (clay). Absent: what is dug out never comes back.
   */
  springRefillPercent?: number;
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

/**
 * What a forester's lodge plants: `object` on empty `on` terrain, only on tiles whose x and y are
 * both multiples of `spacing`, so the rows between stay open to walk through once the trees are
 * grown. A planting takes `plantTicks` of work.
 */
export interface PlantsDef {
  object: MapObjectId;
  on: TerrainId;
  spacing: number;
  plantTicks: number;
}

/**
 * A Crop: sown on a Field, ripe `growDays` after (at the first Dawn from then), harvested once for
 * `yieldPerField` of `resource`.
 */
export interface CropDef {
  id: CropId;
  name: string;
  resource: ResourceId;
  growDays: number;
  yieldPerField: number;
}

/**
 * Farming (spec, Resources: Farms and crops): Fields are painted on `fieldOn` terrain in a farm's
 * radius. Farmers sow them in `sowSeason`, harvest each once when ripe, and clear Fieldstones;
 * whatever still stands at the first Dawn of `idleSeason` is lost, and nothing is done in it.
 */
export interface FarmingDef {
  fieldOn: TerrainId;
  /** The Crop a new farm grows until the player picks another. */
  defaultCrop: CropId;
  sowSeason: SeasonId;
  idleSeason: SeasonId;
  sowTicks: number;
  harvestTicks: number;
  clearTicks: number;
  /**
   * At the first Dawn of `sowSeason` each Field without one throws up a Fieldstone with this
   * chance, in percent; clearing it gives `fieldstone`.
   */
  fieldstonePercent: number;
  fieldstone: ResourceAmount;
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
  /** Walking speed on it, as a percentage (100 = Meadow's). It replaces the terrain's speed. */
  speedPercent: number;
}

/** Logistics numbers. */
export interface LogisticsDef {
  /** Units one stockpile tile holds. */
  stockpileTileCapacity: number;
  /** Units a Workplace yard holds, all its outputs together (`BuildingDef.outputBuffer`). */
  yardCapacity: number;
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

/** How far a sight source sees, in tiles (Chebyshev), by day and by night. */
export interface SightDef {
  day: number;
  night: number;
}

/**
 * Fog (spec, World and map; ADR-0005): what the player has seen. Only where they may build
 * depends on it; nothing in the world does.
 */
export interface FogDef {
  /** At the start, every tile within this many tiles (Chebyshev) of the Camp is Revealed. */
  startRevealTiles: number;
  /** Sight of each kind of source. Lights see their lit tiles at night. */
  sight: {
    hero: SightDef;
    villager: SightDef;
    /** A finished building, round its footprint. */
    building: SightDef;
    /** A watchtower with its Watchman, round its footprint, instead of `building`. */
    mannedWatchtower: SightDef;
  };
}

/** A whole-number range, both ends included. */
export interface IntRange {
  min: number;
  max: number;
}

/**
 * The procedural Valley (spec, World and map: "The Valley", "Forest ecology"). Every distance is
 * in tiles, Chebyshev; every share is a whole percent. The generator lays the Valley out with the
 * entry on the west edge and the Side valley in the south-east corner, then turns or mirrors the
 * whole map, so those two just say how the parts sit relative to each other.
 */
export interface ValleyDef {
  /** Tiles a side. */
  size: number;
  /** Seeds tried (the first, then ones derived from it) before generation gives up. */
  attempts: number;
  /** The Mountain rim round the map: thickness from value noise over cells of `cellTiles`. */
  rim: { thickness: IntRange; cellTiles: number };
  /**
   * The entry: a gap `gapTiles` wide through the rim, somewhere between `alongPercent` of the way
   * along its edge. The rim stays at most `nearThickness` thick near it, so the Camp fits.
   */
  entry: { gapTiles: number; alongPercent: IntRange; nearThickness: number };
  /**
   * The Starting Camp, within `entryTiles` of the entry: a Granary holding `granaryStock`, a 2×2
   * Stockpile holding `stockpileGoods`, `carriers` Homeless Carriers and the Hero. Every tile
   * within `yardTiles` of the Granary's origin is its yard, kept bare of trees.
   */
  camp: {
    entryTiles: number;
    yardTiles: number;
    granaryStock: ResourceAmount[];
    stockpileGoods: ResourceAmount[];
    carriers: number;
  };
  /** What the generator guarantees near the Camp; a Valley missing one is thrown away. */
  guarantees: {
    /** A square this many tiles a side of clear, buildable Meadow (no Swamp) round the Camp. */
    clearTiles: number;
    trees: { withinTiles: number; count: number };
    forage: { withinTiles: number; count: number };
    riverbankTiles: number;
    fordTiles: number;
    /** A group of stone and a group of clay Deposits wholly this close. */
    depositTiles: number;
    /** No Den this close. */
    denTiles: number;
  };
  /**
   * The river, edge to edge: `widthTiles` wide, winding up to `meanderTiles` either way over cells
   * of `cellTiles`, its bank `campBankTiles` from the Camp; `fords` Fords `fordWidthTiles` wide,
   * `fordSpacingTiles` apart.
   */
  river: {
    widthTiles: number;
    meanderTiles: number;
    cellTiles: number;
    campBankTiles: number;
    fords: IntRange;
    fordWidthTiles: number;
    fordSpacingTiles: number;
  };
  /**
   * The Side valley: a corner pocket `widthTiles` × `heightTiles` from the map's edge, walled off by
   * Mountain `wallThickness` thick, through which the Pass (Pass snow, `passWidthTiles` wide) leads.
   */
  sideValley: {
    widthTiles: number;
    heightTiles: number;
    wallThickness: IntRange;
    passWidthTiles: number;
  };
  /**
   * Forest: where value noise over cells of `cellTiles` passes `thresholdPercent`, the Meadow is
   * Forest. How far the noise passes it (its depth, in noise percent) sets the trees: `treePercent`
   * of the tiles from `rampPercent` deep, thinning to `edgeTreePercent` at the edge; past the edge
   * they thin on over `fringePercent` to `outlierPercent`, lone trees on open Meadow. A second
   * noise over cells of `clearing.cellTiles` opens clearings inside the woods where it passes
   * `clearing.thresholdPercent`, with trees on only `clearing.treePercent`. Forage patches stand on
   * `foragePercent` of the Forest. The Camp's own wood, beside it, stands at `campTreePercent`,
   * thinning to `edgeTreePercent` over its last `campRampTiles` toward the Camp and the east, with
   * no clearings. Trees stand on `scatterPercent` of the clear square round the Camp, off its
   * yard.
   */
  forest: {
    cellTiles: number;
    thresholdPercent: number;
    treePercent: number;
    edgeTreePercent: number;
    rampPercent: number;
    fringePercent: number;
    outlierPercent: number;
    clearing: { cellTiles: number; thresholdPercent: number; treePercent: number };
    campTreePercent: number;
    campRampTiles: number;
    foragePercent: number;
    scatterPercent: number;
  };
  /** Swamp patches beside the river's slow bends, each a noisy blob of these radii. */
  swamp: { patches: IntRange; radiusTiles: IntRange };
  /** Rock outcrops: Meadow within `footTiles` of a Mountain where noise passes `thresholdPercent`. */
  rock: { footTiles: number; thresholdPercent: number; cellTiles: number };
  /**
   * Deposits in groups: `groups` of each kind per Valley (both iron in the Side valley), each of
   * `groupSize` Deposits (rolled; a tight patch may hold fewer, never under `groupSize.min`).
   * Every Deposit of a group lies within `linkTiles` (Chebyshev) of another of it, and touches at
   * most one other (so a group is scattered, never a solid clump): each placed apart from the rest
   * unless a `touchPercent` roll lets it touch one, or nothing else fits. Groups stand at least
   * `spacingTiles` apart (more than `linkTiles`, so groups never run together). The Camp's stone
   * group grows on a Rock outcrop `campOutcropTiles` round its first Deposit.
   */
  deposits: {
    groups: { stone: number; clay: number; iron: number };
    groupSize: IntRange;
    linkTiles: number;
    touchPercent: number;
    spacingTiles: number;
    campOutcropTiles: number;
  };
  /** Dens at the start, `sideValley` of them in the Side valley, `spacingTiles` apart. */
  dens: { count: number; sideValley: number; spacingTiles: number };
  /**
   * Points of interest, each a stamp: one Abandoned mine (over an iron Deposit, a Den at its
   * mouth), `ruins` Ruins and one Shrine, the Shrine nearest a point `shrineAlongPercent` of the
   * way from the entry toward the Pass. Ruins and the Shrine stand in the main valley, at least
   * `campTiles` from the Camp, on bare Meadow cleared `clearTiles` round them (Chebyshev). Stamps
   * stand at least `spacingTiles` apart.
   */
  pois: {
    ruins: number;
    campTiles: number;
    clearTiles: number;
    spacingTiles: number;
    shrineAlongPercent: IntRange;
  };
  /**
   * Hunting grounds: each connected stretch of Forest, split so none has more than `maxTiles`;
   * a stretch under `minTiles` holds none. Max Game is 1 per `treesPerGame` trees.
   */
  huntingGrounds: {
    maxTiles: number;
    minTiles: number;
    treesPerGame: number;
    names: readonly string[];
  };
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
  /**
   * A Den the Hero clears (0 HP) leaves `cache` on its tile, and no Den buds within `calmTiles`
   * of it (Chebyshev) for `calmDays` days.
   */
  cleared: {
    cache: ResourceAmount[];
    calmTiles: number;
    calmDays: number;
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
   * A Den the Hero attacks. It stings everyone in its reach (never Gloamlings) and never heals;
   * at 0 HP it's cleared (`DensDef.cleared`).
   */
  den: FighterDef;
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
  /** While 0 < Game < ceiling, a ground gains 1 animal every `recoveryDays` days. */
  recoveryDays: number;
  /**
   * A ground whose Game reaches 0 stays empty for `emptySeasons` full seasons, then
   * `returningGame` animals come back (never above its ceiling).
   */
  emptySeasons: number;
  returningGame: number;
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

/**
 * Groundwork (M4): a 1×1 construction laid tile by tile over `on` terrain by dragging like a Road.
 * Its site blocks nobody; when it's finished the site is gone and the tile has changed for good:
 * its terrain becomes `terrain` (a Drain: Swamp to Meadow) or it holds the Road `road` (a Pass
 * road over Pass snow).
 */
export interface GroundworkDef {
  on: TerrainId;
  becomes: { terrain: TerrainId } | { road: RoadId };
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
  /**
   * The master trade that runs this workshop (spec, Trades and masters): it stands idle until
   * that trade's Master has settled, and crawls once the Master is lost. Absent: no master needed.
   */
  trade?: TradeId;
  /** Map objects its workers gather from, if any. */
  gathers?: MapObjectId[];
  /**
   * Map objects its workers dig out once the player marks them (a woodcutter's hut: Stumps): a
   * gather of the object's `gatherTicks` for `yieldPerGather` of its `resource`, after which it's
   * gone for good. Within `workRadius`, like `gathers`.
   */
  digs?: MapObjectId[];
  /**
   * Its workers gather only within this many tiles of its footprint (Chebyshev distance). Without
   * it they go anywhere.
   */
  workRadius?: number;
  /**
   * Its workers dig the ore (`TerrainDef.ore`) out of tiles of this terrain within its work
   * radius (a bog-iron digger: Swamp), standing on the tile.
   */
  digsOre?: TerrainId;
  /**
   * Terrain it may stand on besides buildable terrain (a quarry: Rock). Its door still needs
   * walkable ground.
   */
  alsoBuildsOn?: TerrainId[];
  /**
   * Placed with its footprint touching a `poi` (Chebyshev 1; a mine at the Abandoned mine), it
   * costs `cost` instead of `construction.cost`.
   */
  cheaperAt?: { poi: PoiId; cost: ResourceAmount[] };
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
  /** Its workers plant `object` (a Sapling) on tiles within its work radius (see `PlantsDef`). */
  plants?: PlantsDef;
  /** Makes it a farm: its workers sow and harvest the Fields in its work radius (`FarmingDef`). */
  farm?: boolean;
  /** Its door must be on a riverbank tile. */
  doorOnRiverbank?: boolean;
  /**
   * What its workers produce, if anything, and its yard: the 1×1 tile of the building beside its
   * door where they drop it (an offset from the origin outside `size`, turning with the building).
   * The yard holds `logistics.yardCapacity` of `resources` in total; Carriers pick up at the door.
   */
  outputBuffer?: { resources: ResourceId[]; yard: { x: number; y: number } };
  /** Recipes its workers work through, in order of preference. Makes the building a workshop. */
  recipes?: RecipeId[];
  /** What a workshop holds of each of its recipes' inputs. Carriers fill it. */
  inputBuffer?: { resource: ResourceId; capacity: number }[];
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
  /** Makes it groundwork (M4): a Drain or a Pass road. */
  groundwork?: GroundworkDef;
  /** A village has at most one, built or under construction. */
  onePerVillage?: boolean;
  /** Makes it the notice board (M5), where Charters and Delivery orders are posted. */
  noticeBoard?: boolean;
  /** Makes it where a Knocked-out Hero gets up (M5: the village hall), at its door, once built. */
  heroRecovers?: boolean;
  /** Cost and time to build it from a construction site. Absent for buildings that can't be built. */
  construction?: { cost: ResourceAmount[]; buildTicks: number };
}

/**
 * What the Hero's Search of a point of interest takes and finds: it stands on the tile for
 * `ticks` by day, then leaves a cache of `cache`, each amount ± `spreadPercent` (rounded down)
 * rolled with the PRNG.
 */
export interface SearchDef {
  ticks: number;
  cache: ResourceAmount[];
  spreadPercent: number;
}

/** A point of interest (spec, World and map: "Points of interest"), placed by the Valley generator. */
export interface PoiDef {
  id: PoiId;
  name: string;
  /** Makes it something the Hero Searches, once. */
  search?: SearchDef;
  /** No Den buds within this many tiles of it (Chebyshev). */
  wardTiles?: number;
}

/** The village's ranks (spec, Progression), lowest first. */
export type RankId = 'camp' | 'hamlet' | 'village' | 'town';

/**
 * A rank. Completing its rank `building` raises the village to it; the building can be placed only
 * while the village has at least `residents` villagers. Reaching it unlocks `unlocks`.
 */
export interface RankDef {
  id: RankId;
  name: string;
  /**
   * The rank building, unlocked by the rank before. Null for Camp (the start) and for a rank whose
   * building isn't in the game yet, which can't be reached.
   */
  building: BuildingId | null;
  residents: number;
  /** Buildings placeable from this rank on. Every placeable building is in exactly one rank's list. */
  unlocks: { buildings: BuildingId[] };
}

/** A master trade: its Master's title. Its workshops are the buildings naming it. */
export interface TradeDef {
  id: TradeId;
  /** The Master's title, e.g. "Carpenter". */
  name: string;
}

/** How a trade's Master changes its workshops' speed (spec, How a trade scales). */
export interface MastersDef {
  /** The Master's own work, in a workshop of their trade, as a percent of normal (+50%: 150). */
  masterSpeedPercent: number;
  /** Every workshop of a trade whose Master is lost, until a new one comes (a crawl: 25). */
  lostSpeedPercent: number;
}

export interface Content {
  resources: Record<ResourceId, ResourceDef>;
  terrain: Record<TerrainId, TerrainDef>;
  mapObjects: Record<MapObjectId, MapObjectDef>;
  jobs: Record<JobId, JobDef>;
  recipes: Record<RecipeId, RecipeDef>;
  crops: Record<CropId, CropDef>;
  farming: FarmingDef;
  buildings: Record<BuildingId, BuildingDef>;
  trades: Record<TradeId, TradeDef>;
  masters: MastersDef;
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
  fog: FogDef;
  valley: ValleyDef;
  pois: Record<PoiId, PoiDef>;
  /** The ranks in order, Camp first. */
  ranks: readonly RankDef[];
  /** First names new villagers are drawn from. */
  villagerNames: readonly string[];
}
