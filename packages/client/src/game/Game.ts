// Glue between the sim worker, the renderer, input and the React HUD. Holds UI-only state
// (speed, build mode); everything about the world comes from sim snapshots.
import { type BuildingId, content, type ResourceId } from '@candlemarch/content';
import {
  type Command,
  canLayPath,
  canPlaceBuilding,
  canPlaceStockpile,
  DEFAULT_MAP,
  type EntityId,
  type GameState,
  heroOf,
  idsOf,
  lShapeTiles,
  type MapName,
  type StockpilePriority,
  TICKS_PER_SECOND,
  type Tile,
} from '@candlemarch/sim';
import { CameraInput } from '../render/camera';
import { type CameraView, gridToWorld, screenToTile } from '../render/iso';
import { type PlacementGhost, WorldRenderer } from '../render/WorldRenderer';
import type { Speed } from './clock';
import { SimBridge } from './SimBridge';

const SAVE_KEY = 'candlemarch.save';
const NEW_GAME_SEED = 1;

export type ToolId = BuildingId | 'path' | 'removePath' | 'stockpile' | 'demolish';

/** HUD tools in toolbar order, with their keyboard shortcut. `drag` tools act on press-drag-release. */
export const TOOLS: readonly {
  id: ToolId;
  label: string;
  key: string;
  drag: boolean;
  hint: string;
}[] = [
  {
    id: 'hut',
    label: 'Hut',
    key: 'b',
    drag: false,
    hint: 'Click to place. Shift-click places more.',
  },
  {
    id: 'woodcutters_hut',
    label: "Woodcutter's hut",
    key: 'w',
    drag: false,
    hint: 'Click to place. Shift-click places more.',
  },
  { id: 'path', label: 'Path', key: 'r', drag: true, hint: 'Drag to lay an L-shaped path.' },
  { id: 'removePath', label: 'Remove path', key: 'x', drag: true, hint: 'Drag to remove path.' },
  { id: 'stockpile', label: 'Stockpile', key: 's', drag: true, hint: 'Drag a rectangle.' },
  {
    id: 'demolish',
    label: 'Demolish',
    key: 'd',
    drag: false,
    hint: 'Click a stockpile or construction site to remove it.',
  },
];

function toolDef(id: ToolId) {
  return TOOLS.find((t) => t.id === id);
}

function isBuilding(id: ToolId): id is BuildingId {
  return id in content.buildings;
}

export interface HudState {
  ready: boolean;
  speed: Speed;
  tool: ToolId | null;
  /** Logs in the woodcutter's hut output buffer, and its capacity. */
  hutLogs: number;
  hutCapacity: number;
  /** In-game time in whole seconds. */
  seconds: number;
  /** The stockpile selected by clicking it with no tool, and its settings. */
  pile: { id: EntityId; priority: StockpilePriority; refuses: ResourceId[] } | null;
  /** The hero is selected, so right-click orders it. */
  heroSelected: boolean;
  message: string | null;
}

export class Game {
  private readonly renderer = new WorldRenderer(content);
  private readonly bridge: SimBridge;
  private input: CameraInput | null = null;
  private readonly camera: CameraView = { x: 0, y: 0, zoom: 0.6 };
  private hover: Tile | null = null;
  /** Tile a tool drag started on, while one is in progress. */
  private dragStart: Tile | null = null;
  private selectedPile: EntityId | null = null;
  private lastSpeed: Speed = 1;
  private hud: HudState = {
    ready: false,
    speed: 1,
    tool: null,
    hutLogs: 0,
    hutCapacity: 0,
    seconds: 0,
    pile: null,
    heroSelected: false,
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

  selectTool(tool: ToolId): void {
    this.dragStart = null;
    this.selectPile(null);
    this.selectHero(false);
    const hint = toolDef(tool)?.hint ?? '';
    this.setHud({ tool, message: `${hint} Esc or right-click cancels.` });
    this.updateGhost();
  }

  /** Leaves the current tool and clears any selection. */
  cancelTool(): void {
    this.dragStart = null;
    this.selectPile(null);
    this.selectHero(false);
    this.setHud({ tool: null, message: null });
    this.updateGhost();
  }

  setPilePriority(priority: StockpilePriority): void {
    const id = this.selectedPile;
    if (id !== null) this.bridge.command({ type: 'setStockpilePriority', id, priority });
  }

  setPileAccepts(resource: ResourceId, accepts: boolean): void {
    const id = this.selectedPile;
    if (id !== null) this.bridge.command({ type: 'setStockpileAccepts', id, resource, accepts });
  }

  /** Starts a new game on `map`, replacing the current one. */
  newGame(map: MapName): void {
    this.cameraCentred = false;
    this.bridge.newGame(NEW_GAME_SEED, map);
    this.dragStart = null;
    this.selectedPile = null;
    this.setHud({ tool: null, pile: null, message: null });
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
    this.dragStart = null;
    this.selectedPile = null;
    this.setHud({ tool: null, pile: null, message: 'Loaded.' });
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
        onToolDown: (sx, sy) => this.onToolDown(sx, sy),
        onToolUp: (sx, sy) => this.onToolUp(sx, sy),
      },
    );
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.abort.signal });
    this.renderer.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
    this.newGame(DEFAULT_MAP);
  }

  private frame(deltaMs: number): void {
    this.bridge.frame(deltaMs);
    this.renderer.applyCamera(this.camera);
    const state = this.bridge.state;
    if (state) {
      this.renderer.drawWalkers(
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
    this.refreshPile(state);
    this.updateGhost();
    if (this.hud.heroSelected && heroOf(state) === null) {
      this.selectHero(false); // a new game or a load without a hero
    }

    const { building } = state.components;
    const hut = Object.values(building).find((b) => b.type === 'woodcutters_hut');
    const buffer = content.buildings.woodcutters_hut.outputBuffer;
    this.setHud({
      ready: true,
      hutLogs: hut && buffer ? (hut.stock[buffer.resource] ?? 0) : 0,
      hutCapacity: buffer?.capacity ?? 0,
      seconds: Math.floor(state.tick / TICKS_PER_SECOND),
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
    const tool = this.hud.tool;
    if (!tool) {
      this.onSelectClick(sx, sy, button);
      return;
    }
    if (button === 2) {
      this.cancelTool();
      return;
    }
    const tile = this.tileAt(sx, sy);
    const state = this.bridge.state;
    if (!state) return;
    if (isBuilding(tool)) {
      if (!canPlaceBuilding(state, content, tool, tile.x, tile.y)) {
        this.setHud({ message: "Can't build there." });
        return;
      }
      this.bridge.command({ type: 'placeBuilding', building: tool, x: tile.x, y: tile.y });
      if (shiftKey) this.setHud({ message: 'Placed. Shift-click to place more.' });
      else this.cancelTool();
      return;
    }
    const command = tool === 'demolish' ? demolishCommand(state, tile) : null;
    if (command) this.bridge.command(command);
    else this.setHud({ message: 'Nothing to remove there.' });
  }

  private onToolDown(sx: number, sy: number): boolean {
    const tool = this.hud.tool;
    if (!tool || !toolDef(tool)?.drag) return false;
    this.dragStart = this.tileAt(sx, sy);
    this.updateGhost();
    return true;
  }

  private onToolUp(sx: number, sy: number): void {
    const from = this.dragStart;
    const tool = this.hud.tool;
    const state = this.bridge.state;
    this.dragStart = null;
    this.updateGhost();
    if (!from || !tool || !state) return;
    const to = this.tileAt(sx, sy);
    if (tool === 'path') {
      if (canLayPath(state, content, from, to)) this.bridge.command({ type: 'layPath', from, to });
      else this.setHud({ message: "Can't lay a path there." });
    } else if (tool === 'removePath') {
      this.bridge.command({ type: 'removePath', from, to });
    } else if (tool === 'stockpile') {
      const r = rect(from, to);
      if (canPlaceStockpile(state, content, r.x, r.y, r.w, r.h))
        this.bridge.command({ type: 'placeStockpile', ...r });
      else this.setHud({ message: "Can't place a stockpile there." });
    }
  }

  /**
   * Clicks with no tool. Left-click selects the hero if it's under the cursor, else the stockpile
   * there (or nothing). Right-click orders the selected hero, RTS style.
   */
  private onSelectClick(sx: number, sy: number, button: number): void {
    const state = this.bridge.state;
    if (!state) return;
    if (button === 0) {
      const hero = this.renderer.hitHero(sx, sy);
      this.selectHero(hero);
      this.selectPile(hero ? null : stockpileAt(state, this.tileAt(sx, sy)));
    } else if (button === 2 && this.hud.heroSelected) {
      const { x, y } = this.tileAt(sx, sy);
      this.bridge.command({ type: 'orderHero', order: 'move', x, y });
    }
  }

  private selectHero(selected: boolean): void {
    this.renderer.setHeroSelected(selected);
    this.setHud({
      heroSelected: selected,
      message: selected ? 'Hero selected. Right-click to move. Esc deselects.' : null,
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.cancelTool();
    else if (e.key === ' ') {
      e.preventDefault();
      this.togglePause();
    } else if (e.key === '1' || e.key === '2' || e.key === '3')
      this.setSpeed(Number(e.key) as Speed);
    else {
      const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
      if (tool) this.selectTool(tool.id);
    }
  }

  private tileAt(sx: number, sy: number): { x: number; y: number } {
    return screenToTile(sx, sy, this.camera, this.renderer.screenWidth, this.renderer.screenHeight);
  }

  private selectPile(id: EntityId | null): void {
    this.selectedPile = id;
    const state = this.bridge.state;
    if (state) this.refreshPile(state);
    this.updateGhost();
  }

  /** Copies the selected stockpile's settings into the HUD, or deselects it once it's gone. */
  private refreshPile(state: GameState): void {
    const id = this.selectedPile;
    const pile = id === null ? undefined : state.components.stockpile[id];
    if (id === null || !pile) {
      this.selectedPile = null;
      this.setHud({ pile: null });
      return;
    }
    const next = { id, priority: pile.priority, refuses: pile.refuses };
    if (JSON.stringify(next) !== JSON.stringify(this.hud.pile)) this.setHud({ pile: next });
  }

  /** The tool's preview under the cursor, or else the selected stockpile highlighted. */
  private updateGhost(): void {
    const state = this.bridge.state;
    const tool = this.hud.tool;
    if (state && tool && this.hover) {
      this.renderer.setGhost(this.ghostFor(state, tool, this.hover));
      return;
    }
    const id = this.selectedPile;
    const at = id === null ? undefined : state?.components.tile[id];
    const pile = id === null ? undefined : state?.components.stockpile[id];
    this.renderer.setGhost(
      at && pile
        ? { kind: 'tiles', tiles: rectTiles(at, pile.size.w, pile.size.h), valid: true }
        : null,
    );
  }

  private ghostFor(state: GameState, tool: ToolId, hover: Tile): PlacementGhost {
    const { x, y } = hover;
    if (isBuilding(tool)) {
      return {
        kind: 'building',
        type: tool,
        x,
        y,
        valid: canPlaceBuilding(state, content, tool, x, y),
      };
    }
    const from = this.dragStart ?? hover;
    switch (tool) {
      case 'path':
        return {
          kind: 'tiles',
          tiles: lShapeTiles(from, hover),
          valid: canLayPath(state, content, from, hover),
        };
      case 'removePath':
        return { kind: 'tiles', tiles: lShapeTiles(from, hover), valid: true };
      case 'stockpile': {
        const r = rect(from, hover);
        return {
          kind: 'tiles',
          tiles: rectTiles(r, r.w, r.h),
          valid: canPlaceStockpile(state, content, r.x, r.y, r.w, r.h),
        };
      }
      case 'demolish':
        return { kind: 'tiles', tiles: [hover], valid: demolishCommand(state, hover) !== null };
    }
  }

  private setHud(patch: Partial<HudState>): void {
    const next = { ...this.hud, ...patch };
    const changed = (Object.keys(patch) as (keyof HudState)[]).some((k) => next[k] !== this.hud[k]);
    if (!changed) return;
    this.hud = next;
    for (const listener of this.listeners) listener();
  }
}

/** The rectangle with corners `a` and `b`, both included. */
function rect(a: Tile, b: Tile): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  };
}

function rectTiles(origin: Tile, w: number, h: number): Tile[] {
  const tiles: Tile[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) tiles.push({ x: origin.x + i, y: origin.y + j });
  }
  return tiles;
}

function covers(origin: Tile | undefined, w: number, h: number, tile: Tile): boolean {
  return (
    origin !== undefined &&
    tile.x >= origin.x &&
    tile.y >= origin.y &&
    tile.x < origin.x + w &&
    tile.y < origin.y + h
  );
}

/** The stockpile covering `tile`, if any. */
function stockpileAt(state: GameState, tile: Tile): EntityId | null {
  const { tile: at, stockpile } = state.components;
  for (const id of idsOf(stockpile)) {
    const pile = stockpile[id];
    if (pile && covers(at[id], pile.size.w, pile.size.h, tile)) return id;
  }
  return null;
}

/** Removes the stockpile or construction site on `tile`, stockpile first. */
function demolishCommand(state: GameState, tile: Tile): Command | null {
  const pile = stockpileAt(state, tile);
  if (pile !== null) return { type: 'removeStockpile', id: pile };
  const { tile: at, site } = state.components;
  for (const id of idsOf(site)) {
    const s = site[id];
    const size = s ? content.buildings[s.type].size : null;
    if (size && covers(at[id], size.w, size.h, tile)) {
      return { type: 'cancelConstruction', siteId: id };
    }
  }
  return null;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
