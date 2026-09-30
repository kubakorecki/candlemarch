// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export { type Alert, type AlertData, type AlertSeverity, alerts, winterIn } from './alerts';
export { boostedWorkplaces } from './aura';
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
export { type HeroOrder, heroOf, heroOrderAt } from './hero';
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
export { DEFAULT_MAP, type MapName, maps } from './maps';
export { bellOf, isBellRung } from './militia';
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
export * from './state';
export { cloneState, step, stepInPlace } from './step';
export { canPlaceStockpile, isStockpileGood, STOCKPILE_PRIORITIES } from './stockpiles';
export { immigrationFoodNeeded, newcomerHome } from './systems/immigration';
export { openPositions } from './systems/staffing';
export { carrierUtilization, roadTraffic } from './traffic';
export { canLayWall, fullHp, isBrokenWall, isWall, isWallType } from './walls';
export { isColdHouse } from './warmth';
export { isOnWatch, isWatchman, towerFoe, towerOf } from './watchtowers';
export { maxWorkers, reassignTargets, workersAt } from './workers';
