// Messages between the main thread and the sim worker.
import type { Command, EntityId, GameState, MapName, Point } from '@candlemarch/sim';
import type { SaveSlot } from './game/autosave';

export type ToWorker =
  | { type: 'newGame'; seed: number; map: MapName; monsterRate: number }
  | { type: 'load'; json: string }
  /** Run `ticks` ticks; `commands` are applied on the first of them. */
  | { type: 'advance'; ticks: number; commands: Command[] }
  /** Save now, into the manual slot. */
  | { type: 'save' };

export type FromWorker =
  /** State after the last tick run, plus villager positions one tick earlier for interpolation. */
  | { type: 'snapshot'; state: GameState; prevPositions: Record<EntityId, Point> }
  /** A save for `slot`, made at `tick`: the manual one asked for, or the autosave at a Dawn. */
  | { type: 'saved'; slot: SaveSlot; tick: number; json: string }
  | { type: 'error'; message: string };
