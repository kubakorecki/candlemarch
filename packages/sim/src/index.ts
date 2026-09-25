// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export type { Command } from './commands';
export { idsOf } from './entities';
export { canPlaceBuilding, doorTile, footprint, tileCenter } from './grid';
export { canPlaceFlag } from './logistics/flagNetwork';
export { unstaffedSegments } from './logistics/flagRelay';
export type { LogisticsModel, LogisticsState } from './logistics/model';
export type { Segment } from './logistics/relayState';
export { createInitialState, type MapDef } from './map';
export { meadowMap } from './maps/meadow';
export { canLayPath, lShapeTiles, roadNeighbours } from './roads';
export { deserialize, serialize } from './save';
export * from './state';
export { step } from './step';
export { canPlaceStockpile } from './stockpiles';
export { openPositions } from './systems/staffing';
