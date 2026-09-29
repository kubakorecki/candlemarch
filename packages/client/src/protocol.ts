// Messages between the main thread and the sim worker.
import type { Command, EntityId, GameState, MapName, Point, StaticLayers } from '@candlemarch/sim';
import type { SaveSlot } from './game/autosave';

export type ToWorker =
  | { type: 'newGame'; seed: number; map: MapName; monsterRate: number }
  | { type: 'load'; json: string }
  /** Run `ticks` ticks; `commands` are applied on the first of them. */
  | { type: 'advance'; ticks: number; commands: Command[] }
  /** Save now, into the manual slot. */
  | { type: 'save' };

export type FromWorker =
  /**
   * State after the last tick run, split (`movingPart`): the moving part every time, the static
   * layers only when they changed since the last snapshot (else null; the first snapshot of a game
   * always has them). Plus positions one tick earlier, for interpolation.
   */
  | {
      type: 'snapshot';
      moving: GameState;
      layers: StaticLayers | null;
      prevPositions: Record<EntityId, Point>;
    }
  /** A save for `slot`, made at `tick`: the manual one asked for, or the autosave at a Dawn. */
  | { type: 'saved'; slot: SaveSlot; tick: number; json: string }
  | { type: 'error'; message: string };
