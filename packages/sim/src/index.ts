// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export { boostedWorkplaces } from './aura';
export type { Command } from './commands';
export { idsOf } from './entities';
export { canPlaceBuilding, doorTile, footprint, tileCenter, tileOfPoint } from './grid';
export { type HeroOrder, heroOf, heroOrderAt } from './hero';
export type { Haul, LogisticsState } from './logistics/jobDispatch';
export { createInitialState, type MapDef } from './map';
export { DEFAULT_MAP, type MapName, maps } from './maps';
export { canLayPath, lShapeTiles, roadNeighbours } from './roads';
export { deserialize, serialize } from './save';
export * from './state';
export { step } from './step';
export { canPlaceStockpile, STOCKPILE_PRIORITIES } from './stockpiles';
export { openPositions } from './systems/staffing';
