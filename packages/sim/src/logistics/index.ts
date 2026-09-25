// Registry of logistics models. The game's `state.logistics.model` picks which one runs.
import { flagRelay } from './flagRelay';
import { jobDispatch } from './jobDispatch';
import type { LogisticsModel, LogisticsModelId } from './model';

export const logisticsModels: Record<LogisticsModelId, LogisticsModel> = { jobDispatch, flagRelay };

/** Model used for new games. */
export const DEFAULT_LOGISTICS_MODEL: LogisticsModelId = 'jobDispatch';
