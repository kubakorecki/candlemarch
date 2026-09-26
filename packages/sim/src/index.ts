// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export type { Command } from './commands';
export { idsOf } from './entities';
export { canPlaceBuilding, doorTile, footprint, tileCenter } from './grid';
export { DEFAULT_LOGISTICS_MODEL } from './logistics';
export { canPlaceFlag } from './logistics/flagNetwork';
export { unstaffedSegments } from './logistics/flagRelay';
export type { LogisticsModel, LogisticsModelId, LogisticsState } from './logistics/model';
export type { Segment } from './logistics/relayState';
export { createInitialState, type MapDef } from './map';
export { DEFAULT_MAP, type MapName, maps } from './maps';
export { canLayPath, lShapeTiles, roadNeighbours } from './roads';
export { deserialize, serialize } from './save';
export * from './state';
export { step } from './step';
export { canPlaceStockpile, STOCKPILE_PRIORITIES } from './stockpiles';
export { openPositions } from './systems/staffing';
