// Glue between the sim worker, the renderer, input and the React HUD. Holds UI-only state
// (speed, build mode); everything about the world comes from sim snapshots.
import { type BuildingId, content } from '@candlemarch/content';
import {
  canPlaceBuilding,
  DEFAULT_LOGISTICS_MODEL,
  DEFAULT_MAP,
  type GameState,
  type LogisticsModelId,
  type MapName,
  TICKS_PER_SECOND,
} from '@candlemarch/sim';
import { CameraInput } from '../render/camera';
import { type CameraView, gridToWorld, screenToTile } from '../render/iso';
import { WorldRenderer } from '../render/WorldRenderer';
import type { Speed } from './clock';
import { SimBridge } from './SimBridge';

const SAVE_KEY = 'candlemarch.save';
const NEW_GAME_SEED = 1;

export interface HudState {
  ready: boolean;
  speed: Speed;
  buildMode: BuildingId | null;
  /** Logs in the woodcutter's hut output buffer, and its capacity. */
  hutLogs: number;
  hutCapacity: number;
  /** In-game time in whole seconds. */
  seconds: number;
  /** Logistics model of the running game. */
  model: LogisticsModelId | null;
  message: string | null;
}

export class Game {
  private readonly renderer = new WorldRenderer(content);
  private readonly bridge: SimBridge;
  private input: CameraInput | null = null;
  private readonly camera: CameraView = { x: 0, y: 0, zoom: 0.6 };
  private hover: { x: number; y: number } | null = null;
  private lastSpeed: Speed = 1;
  private hud: HudState = {
    ready: false,
    speed: 1,
    buildMode: null,
    hutLogs: 0,
    hutCapacity: 0,
    seconds: 0,
    model: null,
    message: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly abort = new AbortController();
  private cameraCentred = false;

  private constructor() {
    this.bridge = new SimBridge({
      onSnapshot: (state) => this.onSnapshot(state),
      onSaved: (json) => this.onSaved(json),
      onError: (message) => this.setHud({ message: `Error: ${message}` }),
    });
  }

  static async create(parent: HTMLElement): Promise<Game> {
    const game = new Game();
    await game.renderer.init(parent);
    game.start();
    return game;
  }

  // --- React HUD store (for useSyncExternalStore) ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getHud = (): HudState => this.hud;

  // --- HUD actions ---

  setSpeed(speed: Speed): void {
    if (speed > 0) this.lastSpeed = speed;
    this.bridge.speed = speed;
    this.setHud({ speed });
  }

  togglePause(): void {
    this.setSpeed(this.bridge.speed === 0 ? this.lastSpeed : 0);
  }

  startBuild(type: BuildingId): void {
    this.setHud({
      buildMode: type,
      message: 'Click a tile to place it. Esc or right-click cancels.',
    });
    this.updateGhost();
  }

  cancelBuild(): void {
    this.setHud({ buildMode: null, message: null });
    this.updateGhost();
  }

  /** Starts a new game on `map` with logistics model `model`, replacing the current one. */
  newGame(map: MapName, model: LogisticsModelId): void {
    this.cameraCentred = false;
    this.bridge.newGame(NEW_GAME_SEED, map, model);
    this.setHud({ buildMode: null, message: null });
    this.updateGhost();
  }

  save(): void {
    this.bridge.save();
  }

  load(): void {
    let json: string | null = null;
    try {
      json = localStorage.getItem(SAVE_KEY);
    } catch {
      json = null;
    }
    if (!json) {
      this.setHud({ message: 'No save found.' });
      return;
    }
    // The save may be on another map, so centre the camera on it.
    this.cameraCentred = false;
    this.bridge.load(json);
    this.setHud({ buildMode: null, message: 'Loaded.' });
  }

  destroy(): void {
    this.abort.abort();
    this.input?.dispose();
    this.bridge.dispose();
    this.renderer.destroy();
  }

  // --- internals ---

  private start(): void {
    this.input = new CameraInput(
      this.renderer.canvas,
      this.camera,
      () => ({ w: this.renderer.screenWidth, h: this.renderer.screenHeight }),
      {
        onHover: (sx, sy) => {
          this.hover = this.tileAt(sx, sy);
          this.updateGhost();
        },
        onLeave: () => {
          this.hover = null;
          this.updateGhost();
        },
        onClick: (sx, sy, button, shiftKey) => this.onClick(sx, sy, button, shiftKey),
      },
    );
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.abort.signal });
    this.renderer.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
    this.newGame(DEFAULT_MAP, DEFAULT_LOGISTICS_MODEL);
  }

  private frame(deltaMs: number): void {
    this.bridge.frame(deltaMs);
    this.renderer.applyCamera(this.camera);
    const state = this.bridge.state;
    if (state) {
      this.renderer.drawVillagers(
        state,
        this.bridge.prevPositions,
        this.bridge.alpha,
        performance.now(),
      );
    }
  }

  private onSnapshot(state: GameState): void {
    if (!this.cameraCentred) {
      const c = gridToWorld(state.map.width / 2, state.map.height / 2);
      this.camera.x = c.x;
      this.camera.y = c.y;
      this.cameraCentred = true;
    }
    this.renderer.syncStatics(state);
    this.updateGhost();

    const { building } = state.components;
    const hut = Object.values(building).find((b) => b.type === 'woodcutters_hut');
    const buffer = content.buildings.woodcutters_hut.outputBuffer;
    this.setHud({
      ready: true,
      hutLogs: hut && buffer ? (hut.stock[buffer.resource] ?? 0) : 0,
      hutCapacity: buffer?.capacity ?? 0,
      seconds: Math.floor(state.tick / TICKS_PER_SECOND),
      model: state.logistics.model,
    });
  }

  private onSaved(json: string): void {
    try {
      localStorage.setItem(SAVE_KEY, json);
      this.setHud({ message: `Saved at ${formatTime(this.hud.seconds)}.` });
    } catch (error) {
      this.setHud({ message: `Save failed: ${String(error)}` });
    }
  }

  private onClick(sx: number, sy: number, button: number, shiftKey: boolean): void {
    const type = this.hud.buildMode;
    if (!type) return;
    if (button === 2) {
      this.cancelBuild();
      return;
    }
    const tile = this.tileAt(sx, sy);
    const state = this.bridge.state;
    if (!state || !canPlaceBuilding(state, content, type, tile.x, tile.y)) {
      this.setHud({ message: "Can't build there." });
      return;
    }
    this.bridge.command({ type: 'placeBuilding', building: type, x: tile.x, y: tile.y });
    if (shiftKey) this.setHud({ message: 'Placed. Shift-click to place more.' });
    else this.cancelBuild();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.cancelBuild();
    else if (e.key === ' ') {
      e.preventDefault();
      this.togglePause();
    } else if (e.key === '1' || e.key === '2' || e.key === '3')
      this.setSpeed(Number(e.key) as Speed);
    else if (e.key === 'b') this.startBuild('hut');
  }

  private tileAt(sx: number, sy: number): { x: number; y: number } {
    return screenToTile(sx, sy, this.camera, this.renderer.screenWidth, this.renderer.screenHeight);
  }

  private updateGhost(): void {
    const type = this.hud.buildMode;
    const state = this.bridge.state;
    if (!type || !this.hover || !state) {
      this.renderer.setGhost(null);
      return;
    }
    const { x, y } = this.hover;
    this.renderer.setGhost({ type, x, y, valid: canPlaceBuilding(state, content, type, x, y) });
  }

  private setHud(patch: Partial<HudState>): void {
    const next = { ...this.hud, ...patch };
    const changed = (Object.keys(patch) as (keyof HudState)[]).some((k) => next[k] !== this.hud[k]);
    if (!changed) return;
    this.hud = next;
    for (const listener of this.listeners) listener();
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
