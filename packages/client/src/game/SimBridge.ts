// Main-thread side of the sim worker: owns the clock, queues commands, keeps the latest snapshot.
import type { Command, EntityId, GameState, MapName, Point } from '@candlemarch/sim';
import type { FromWorker, ToWorker } from '../protocol';
import type { SaveSlot } from './autosave';
import { type ClockState, type Speed, tickClock, tickFraction } from './clock';

/** Most ticks sent in one request; anything beyond is dropped rather than caught up. */
const MAX_TICKS_PER_REQUEST = 10;

export interface SimBridgeEvents {
  onSnapshot(state: GameState): void;
  onSaved(json: string, slot: SaveSlot, tick: number): void;
  onError(message: string): void;
}

export class SimBridge {
  state: GameState | null = null;
  prevPositions: Record<EntityId, Point> = {};
  speed: Speed = 1;

  private readonly worker: Worker;
  private readonly clock: ClockState = { accumulator: 0 };
  private inFlight = false;
  private dueTicks = 0;
  private queued: Command[] = [];

  constructor(private readonly events: SimBridgeEvents) {
    this.worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.addEventListener('message', (event: MessageEvent<FromWorker>) =>
      this.receive(event.data),
    );
    this.worker.addEventListener('error', (event) => {
      this.inFlight = false;
      this.events.onError(event.message || 'the sim worker failed to start');
    });
  }

  newGame(seed: number, map: MapName, monsterRate: number): void {
    this.reset();
    this.post({ type: 'newGame', seed, map, monsterRate });
  }

  load(json: string): void {
    this.reset();
    this.post({ type: 'load', json });
  }

  save(): void {
    this.post({ type: 'save' });
  }

  /** Queues a command for the next tick. While paused it waits until the game runs again. */
  command(command: Command): void {
    this.queued.push(command);
  }

  /** Call once per rendered frame. Once the game is over, no more ticks run. */
  frame(frameMs: number): void {
    this.dueTicks = Math.min(
      this.dueTicks + tickClock(this.clock, frameMs, this.speed),
      MAX_TICKS_PER_REQUEST,
    );
    if (this.inFlight || this.dueTicks === 0 || !this.state || this.state.gameOver) return;
    this.post({ type: 'advance', ticks: this.dueTicks, commands: this.queued });
    this.dueTicks = 0;
    this.queued = [];
  }

  /** Interpolation factor between `prevPositions` (0) and the snapshot's positions (1). */
  get alpha(): number {
    return this.inFlight || this.dueTicks > 0 ? 1 : tickFraction(this.clock);
  }

  dispose(): void {
    this.worker.terminate();
  }

  private reset(): void {
    this.clock.accumulator = 0;
    this.dueTicks = 0;
    this.queued = [];
  }

  private post(message: ToWorker): void {
    if (message.type !== 'save') this.inFlight = true;
    this.worker.postMessage(message);
  }

  private receive(message: FromWorker): void {
    switch (message.type) {
      case 'snapshot':
        this.inFlight = false;
        this.state = message.state;
        this.prevPositions = message.prevPositions;
        this.events.onSnapshot(message.state);
        return;
      case 'saved':
        this.events.onSaved(message.json, message.slot, message.tick);
        return;
      case 'error':
        this.inFlight = false;
        this.events.onError(message.message);
        return;
    }
  }
}
