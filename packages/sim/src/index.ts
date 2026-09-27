// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export { boostedWorkplaces } from './aura';
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
export type { Command } from './commands';
export { idsOf } from './entities';
export { foodIds, villageFood } from './granary';
export { canPlaceBuilding, doorTile, footprint, tileCenter, tileOfPoint } from './grid';
export { type HeroOrder, heroOf, heroOrderAt } from './hero';
export type { Haul, LogisticsState } from './logistics/jobDispatch';
export { createInitialState, type MapDef } from './map';
export { DEFAULT_MAP, type MapName, maps } from './maps';
export { canLayPath, lShapeTiles, roadNeighbours } from './roads';
export { deserialize, serialize } from './save';
export * from './state';
export { step } from './step';
export { canPlaceStockpile, isStockpileGood, STOCKPILE_PRIORITIES } from './stockpiles';
export { openPositions } from './systems/staffing';
export { maxWorkers, reassignTargets, workersAt } from './workers';
