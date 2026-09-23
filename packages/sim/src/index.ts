// Deterministic, headless simulation for Candlemarch. See CLAUDE.md "Simulation rules".
export type { Command } from './commands';
export { idsOf } from './entities';
export { canPlaceBuilding, doorTile, footprint, tileCenter } from './grid';
export type { LogisticsModel, LogisticsState } from './logistics/model';
export { createInitialState, type MapDef } from './map';
export { meadowMap } from './maps/meadow';
export { deserialize, serialize } from './save';
export * from './state';
export { step } from './step';
