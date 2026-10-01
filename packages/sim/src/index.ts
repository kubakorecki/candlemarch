// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export { type Alert, type AlertData, type AlertSeverity, alerts, winterIn } from './alerts';
export { boostedWorkplaces } from './aura';
export { bogIronLost, bogIronNear, oreAt, oreCap } from './bogIron';
export { type WorkplaceStatus, workplaceStatus } from './bottlenecks';
export {
  type CalendarTime,
  calendarAt,
  dawnTick,
  duskTick,
  isDawn,
  isDusk,
  isNight,
  isRiverFrozen,
} from './calendar';
export { type HealthBar, healthBars, isIndoors, isKnockedOut } from './combat';
export type { Command } from './commands';
export { constructionCost, siteCost } from './costs';
export { darkRingTiles, denAt } from './dens';
export { depositFits, isDeposit } from './deposits';
export { idsOf } from './entities';
export { hasTile, isInSight, isRevealed } from './fog';
export { isForagePatch, isWithered } from './forage';
export { foodIds, villageFood } from './granary';
export {
  type BuildingLayout,
  buildingLayout,
  canPlaceBuilding,
  doorTile,
  entityLayout,
  footprint,
  tileCenter,
  tileOfPoint,
} from './grid';
export { canLayGroundwork, groundworkOf } from './groundwork';
export { type HeroOrder, heroOf, heroOrderAt, heroSearch, recoveryTile } from './hero';
export {
  addHuntingGround,
  type GroundHealth,
  type GroundRegrowth,
  groundAt,
  groundCeiling,
  groundHealth,
  groundMiddle,
  groundRegrowth,
  groundsInReach,
  groundsNear,
  groundTiles,
  huntChancePermille,
  inGround,
} from './huntingGrounds';
export { isDarkLight, type LightSource, lightSources } from './lights';
export type { Haul, LogisticsState } from './logistics/jobDispatch';
export { createInitialState, type MapDef } from './map';
export { type MapName, maps } from './maps';
export { canMark } from './marks';
export { bellOf, isBellRung } from './militia';
export { campCentre, type NewGameMap, type NewGameSetup, newGame } from './newGame';
export { isSearchable, poiAt } from './pois';
export { type RankLock, type RankProgress, rankLock, rankProgress } from './ranks';
export {
  addToReserve,
  canPaintReserve,
  fellsTrees,
  inReserve,
  reserveNear,
  reserveRect,
} from './reserves';
export { canLayPath, lShapeTiles, roadNeighbours } from './roads';
export { deserialize, serialize } from './save';
export {
  applyStaticPatch,
  joinSnapshot,
  movingPart,
  type StaticLayers,
  type StaticPatch,
  sentStaticLayers,
  staticLayers,
  staticPatch,
} from './snapshot';
export {
  MAX_STANDING_ORDER,
  type StandingOrder,
  standingOrderOf,
} from './standingOrders';
export * from './state';
export { cloneState, step, stepInPlace } from './step';
export { canPlaceStockpile, isStockpileGood, STOCKPILE_PRIORITIES } from './stockpiles';
export { type Storage, storageOf } from './storage';
export { immigrationFoodNeeded, newcomerHome } from './systems/immigration';
export { openPositions } from './systems/staffing';
export { carrierUtilization, roadTraffic } from './traffic';
export { generateValley, type Valley } from './valley/generate';
export { isHelpingCarry } from './villagers';
export { canLayWall, fullHp, isBrokenWall, isWall, isWallType } from './walls';
export { isColdHouse } from './warmth';
export { isOnWatch, isWatchman, towerFoe, towerOf } from './watchtowers';
export { maxWorkers, reassignTargets, workersAt } from './workers';
export { yardAmount } from './yards';
