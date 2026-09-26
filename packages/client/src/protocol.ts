// Messages between the main thread and the sim worker.
import type { Command, EntityId, GameState, MapName, Point } from '@candlemarch/sim';

export type ToWorker =
  | { type: 'newGame'; seed: number; map: MapName }
  | { type: 'load'; json: string }
  /** Run `ticks` ticks; `commands` are applied on the first of them. */
  | { type: 'advance'; ticks: number; commands: Command[] }
  | { type: 'save' };

export type FromWorker =
  /** State after the last tick run, plus villager positions one tick earlier for interpolation. */
  | { type: 'snapshot'; state: GameState; prevPositions: Record<EntityId, Point> }
  | { type: 'saved'; json: string }
  | { type: 'error'; message: string };
