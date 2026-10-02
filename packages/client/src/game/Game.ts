// Glue between the sim worker, the renderer, input and the React HUD. Holds UI-only state
// (speed, build mode); everything about the world comes from sim snapshots.
import {
  type BuildingId,
  type CropId,
  content,
  type JobId,
  type PoiId,
  type ResourceId,
} from '@candlemarch/content';
import {
  type AlertData,
  type AlertSeverity,
  alerts,
  bellOf,
  bogIronLost,
  bogIronNear,
  type Command,
  calendarAt,
  campCentre,
  canBeField,
  canLayGroundwork,
  canLayPath,
  canLayWall,
  canMark,
  canPaintReserve,
  canPlaceBuilding,
  canPlaceStockpile,
  carrierUtilization,
  DEFAULT_MONSTER_RATE,
  darkRingTiles,
  denAt,
  type EntityId,
  entityLayout,
  farmCrop,
  farmFields,
  farmNextCrop,
  fellsTrees,
  fieldAt,
  type GameState,
  type GroundHealth,
  groundAt,
  groundHealth,
  groundRegrowth,
  groundsInReach,
  groundsNear,
  groundTiles,
  groundworkOf,
  type HeroOrder,
  heroOf,
  heroOrderAt,
  huntChancePermille,
  idsOf,
  isBellRung,
  isFarm,
  isForagePatch,
  isHelpingCarry,
  isKnockedOut,
  isRevealed,
  isWithered,
  lShapeTiles,
  MAX_SELL_KEEP,
  MAX_STANDING_ORDER,
  masterOf,
  maxWorkers,
  merchantPays,
  type NewGameSetup,
  nextMerchantDay,
  oreAt,
  oreCap,
  poiAt,
  postings,
  type RankLock,
  type Rotation,
  rankLock,
  rankProgress,
  reassignTargets,
  recoveryTile,
  reserveNear,
  reserveRect,
  type StandingOrder,
  type StockpilePriority,
  type Storage,
  standingOrderOf,
  storageOf,
  type Tile,
  treasuryCoin,
  villageFood,
  villageStock,
  winterIn,
  workersAt,
  workplaceStatus,
  yardAmount,
} from '@candlemarch/sim';
import { CameraInput } from '../render/camera';
import { type CameraView, gridToWorld, screenToTile, unitsToGrid } from '../render/iso';
import { nightLook } from '../render/night';
import { HEALTH_WORDS, type PlacementGhost, WorldRenderer } from '../render/WorldRenderer';
import {
  alertText,
  deathText,
  gameOverText,
  knockoutText,
  regrowthText,
  utilizationText,
  winterText,
  workplaceStatusText,
} from './alertText';
import { type DayTrack, dayTrack } from './almanac';
import { SAVE_SLOTS, type SaveSlot, seasonName, slotDateLabel } from './autosave';
import type { Speed } from './clock';
import { keyAction } from './keys';
import { stockpileGoods } from './ledger';
import { type PostingView, postingView } from './postingText';
import { lockText, rankText } from './rankText';
import { SimBridge } from './SimBridge';
import { type ToolId, toolDef } from './tools';
import { merchantText, priceText } from './tradeText';

/** The game the page opens on: a generated Valley under Fog. */
const FIRST_GAME: NewGameSetup = {
  map: 'valley',
  seed: 1,
  monsterRate: DEFAULT_MONSTER_RATE,
  fog: true,
};

/** A building placed with a click (not a wall or groundwork, which are dragged). */
function isBuilding(id: ToolId): id is BuildingId {
  return id in content.buildings && !isWallTool(id) && !isGroundworkTool(id);
}

/** Groundwork (a Drain, a Pass road) laid by dragging, like a path. */
function isGroundworkTool(id: ToolId): id is BuildingId {
  return id in content.buildings && groundworkOf(content, id as BuildingId) !== undefined;
}

/** A wall segment laid by dragging, like a path. */
function isWallTool(id: ToolId): id is BuildingId {
  return id in content.buildings && content.buildings[id as BuildingId].wall !== undefined;
}

/** Why a drag of groundwork `tool` was refused. */
function groundworkRefusal(tool: BuildingId): string {
  const on = groundworkOf(content, tool)?.on;
  return on ? `Lay it on ${content.terrain[on].name} only.` : "Can't build there.";
}

/** What the villager panel shows, as display text. */
export interface VillagerInfo {
  name: string;
  job: string;
  jobId: JobId;
  /** The Workplace's name, or null without one. */
  workplace: string | null;
  /** The Home's name, or null when Homeless. */
  home: string | null;
  tired: boolean;
  /** "2 days without food; dies after 3" while Hungry, otherwise null. */
  hunger: string | null;
  /** "1 cold night; freezes after 2" while Cold, otherwise null. */
  cold: string | null;
  /** A worker holding a Haul because its Workplace can't use it now. */
  helpingCarry: boolean;
  /** A Master's title ("Carpenter"), or null for anyone else. */
  master: string | null;
}

/** A row of the workers view: one villager, as display text, and where it can be reassigned. */
export interface WorkerRow {
  id: EntityId;
  name: string;
  job: string;
  jobId: JobId;
  /** A Master's title ("Carpenter"), or null for anyone else. */
  master: string | null;
  /** The Workplace's name, or null for a Carrier. */
  workplace: string | null;
  /** Workplaces with a free position, by name. */
  targets: { id: EntityId; name: string }[];
}

export interface WorkersView {
  carriers: number;
  workers: number;
  rows: WorkerRow[];
}

/** What the patch panel shows for the selected forage patch. */
export interface PatchInfo {
  name: string;
  /** What it grows. */
  resource: ResourceId;
  /** "3 berries", or "Nothing to gather". */
  stock: string;
  /** "No shade: needs a tree within 2 tiles to regrow" once withered, otherwise null. */
  noShade: string | null;
}

/** What the Swamp panel shows for a selected tile that holds bog iron. */
export interface SwampInfo {
  /** The terrain's name. */
  name: string;
  /** "Bog iron 1 / 2". */
  ore: string;
}

/** The canvas cursor for the hero's order under the mouse: attack, Search, or the default. */
type HeroCursor = 'crosshair' | 'zoom-in' | '';

/** What the point-of-interest panel shows for the selected Ruins, Abandoned mine or Shrine. */
export interface PoiInfo {
  kind: PoiId;
  name: string;
  /** Ruins: "Searched" or "Not yet Searched"; null for the others. */
  sub: string | null;
  /** What it is or does: how to Search it, a Shrine's ward, the mine's iron. */
  note: string;
}

/** What the ground panel, or a hunter's lodge's panel, shows for one Hunting ground. */
export interface GroundInfo {
  id: EntityId;
  name: string;
  /** Health: its key (for the colour) and its word. */
  health: GroundHealth;
  word: string;
  /** "Game 12 / 20 · 2 fled due to logging · catch chance 30%". */
  summary: string;
  /** "Empty; Game returns in 6 days" or "Recovering", else null. */
  regrowth: string | null;
}

/** What the building panel shows for the selected building. */
export interface BuildingInfo {
  type: BuildingId;
  name: string;
  /**
   * Its yard (output buffer), or null without one: all it holds, how much fits in total, and
   * what it holds of each output.
   */
  yard: {
    amount: number;
    capacity: number;
    goods: { resource: ResourceId; amount: number }[];
  } | null;
  /** What it keeps inside (a Granary's Food), or null for a building that keeps nothing. */
  storage: Storage | null;
  /** Its standing order (pause at N of its output), or null for a building without outputs. */
  standingOrder: StandingOrder | null;
  /** Hunting grounds its hunters reach; empty unless it hunts. */
  grounds: GroundInfo[];
  /** The ground a hunter's lodge is set to hunt, or null for the nearest with Game. */
  huntingGround: EntityId | null;
  workers: { id: EntityId; name: string; job: string; jobId: JobId; master: string | null }[];
  workerLimit: number;
  maxWorkers: number;
  /** Why it's idle, e.g. "Waiting for logs", or null while it works. */
  status: string | null;
  /** It's the Militia bell, so the panel can ring it. */
  bell: boolean;
  /** It fells trees (a woodcutter's hut), so the panel has the tree tools (`TREE_TOOLS`). */
  treeTools: boolean;
  /** A farm's Fields and Crop, for its panel (with the Field tools); null for any other building. */
  farm: FarmInfo | null;
  /** What's posted on it, for the notice board; null for any other building. */
  postings: PostingView[] | null;
  /** Sell rules, prices and Merchants, for the trade post; null for any other building. */
  tradePost: TradePostInfo | null;
}

/** What the trade post's panel shows. */
export interface TradePostInfo {
  /** When Merchants come, e.g. "Next Merchant in 2 days". */
  merchant: string;
  /** The next (or present) Merchant's Wanted list, or null until it's announced. */
  wanted: ResourceId[] | null;
  /** A row per good with a sell rule, held by the village, or Wanted, in content order. */
  goods: SellRow[];
}

/** One good in the trade post's panel. */
export interface SellRow {
  resource: ResourceId;
  /** Its sell rule: keep this many, sell the rest; null: not sold. */
  keep: number | null;
  /** What the village holds of it, goods for sale left out. */
  held: number;
  /** What a Merchant pays for the next unit, e.g. "2.00" (Wanted bonus included). */
  price: string;
  wanted: boolean;
}

/** What a farm's panel shows. */
export interface FarmInfo {
  /** Fields in its reach, and of those how many are sown and ripe. */
  fields: number;
  sown: number;
  ripe: number;
  /** Its Crop this year, and the one picked for the next spring (the same unless changed). */
  crop: CropId;
  nextCrop: CropId;
  /** The Crops the picker offers, in content order. */
  crops: { id: CropId; name: string }[];
}

/** One save slot in the Load menu: its name and when it was saved, or null when it's empty. */
export interface LoadSlotView {
  slot: SaveSlot;
  name: string;
  date: string | null;
}

export type AlertKind = AlertData['kind'];

/** One line of the alert list. Clicking it moves the camera to `target`. */
export interface AlertView {
  kind: AlertKind;
  severity: AlertSeverity;
  text: string;
  target: Tile | null;
}

/** Deaths shown in the message log, newest first. */
const DEATH_LOG_LENGTH = 5;

export interface HudState {
  ready: boolean;
  speed: Speed;
  tool: ToolId | null;
  /** Days since the game began, the season's name, the day within it and the year. */
  day: number;
  season: string;
  dayOfSeason: number;
  year: number;
  /** Where the day is between two Dawns, and what to call that time. */
  dayTrack: DayTrack;
  /** Villagers alive. */
  villagers: number;
  /** Goods on Stockpiles, by resource. */
  goods: Partial<Record<ResourceId, number>>;
  /** Villagers with no Home. */
  homeless: number;
  /** Villagers who missed their last Meal. */
  hungry: number;
  /** Villagers who spent their last night cold. */
  cold: number;
  /** Food in every Granary. */
  food: number;
  /** Whole coins in the Treasury. */
  treasury: number;
  /** Carrier utilization over the last day, e.g. "64%", and as a number (null: no Carrier worked). */
  carriersBusy: string;
  carriersBusyPercent: number | null;
  /** The road heat-map is showing. */
  heatMap: boolean;
  /** "Winter in N days" through autumn, else null. */
  winter: string | null;
  /** The sim's alerts, red first. */
  alerts: AlertView[];
  /** The latest deaths, newest first, e.g. "Ada starved, day 14". */
  deathLog: string[];
  /** Set once the last villager has died: how and when, e.g. "The last villager froze on day 17." */
  gameOver: string | null;
  /** The stockpile selected by clicking it with no tool, and its settings. */
  pile: { id: EntityId; priority: StockpilePriority; refuses: ResourceId[] } | null;
  /** The villager selected by clicking it with no tool. */
  villager: VillagerInfo | null;
  /** The Workplace selected by clicking it with no tool. */
  building: BuildingInfo | null;
  /** The forage patch selected by clicking it with no tool. */
  patch: PatchInfo | null;
  /** The Hunting ground selected by clicking it with no tool. */
  ground: GroundInfo | null;
  /** The point of interest selected by clicking it with no tool. */
  poi: PoiInfo | null;
  /** The Swamp tile selected by clicking it with no tool. */
  swamp: SwampInfo | null;
  /**
   * A warning about the building being placed, e.g. that it would log a Hunting ground or a
   * Drain would lose bog iron.
   */
  placementWarning: string | null;
  /** A plain note about the building being placed: the bog iron a digger would reach. */
  placementNote: string | null;
  /** The workers view, while it's open. */
  workers: WorkersView | null;
  /** The Load menu, while it's open: each save slot, in order. */
  loadMenu: LoadSlotView[] | null;
  /** The hero is selected, so right-click orders it. */
  heroSelected: boolean;
  /** This game's Monster rate, 0–100. */
  monsterRate: number;
  /** Fog is on in this game. */
  fog: boolean;
  /** What the hero holds, e.g. "3/5 logs", or null if this game has no hero. */
  heroLoad: string | null;
  /** "Knocked out, up in 14 s" while the hero is Knocked out, else null. */
  heroKnockout: string | null;
  /** The hero's hit points and its most, or null if this game has no hero. */
  heroHp: { hp: number; max: number } | null;
  /** The Militia bell: whether it's ringing, or null while the village has none built. */
  bell: { ringing: boolean } | null;
  /** The village's rank and its next step, e.g. "Camp", "Toward Hamlet: 7/10 residents". */
  rank: { rank: string; next: string | null };
  /** Buildings the rank keeps the player from placing, and why (`rankLock`). */
  locks: Partial<Record<BuildingId, RankLock>>;
  message: string | null;
}

export class Game {
  private readonly renderer = new WorldRenderer(content);
  private readonly bridge: SimBridge;
  private input: CameraInput | null = null;
  private readonly camera: CameraView = { x: 0, y: 0, zoom: 0.6 };
  private hover: Tile | null = null;
  /** Screen point under the mouse, or null when it's off the canvas. */
  private pointer: { sx: number; sy: number } | null = null;
  /** The cursor the canvas shows for the hero's order under the mouse: attack, Search or none. */
  private cursor: HeroCursor = '';
  /** The last Search check under the mouse: its state and tile, and whether it was a Search. */
  private searchUnder: { state: GameState; tile: Tile; search: boolean } | null = null;
  /** Tile a tool drag started on, while one is in progress. */
  private dragStart: Tile | null = null;
  /** Quarter turns clockwise the next building is placed with; kept between placements. */
  private rotation: Rotation = 0;
  private selectedPile: EntityId | null = null;
  private selectedVillager: EntityId | null = null;
  private selectedBuilding: EntityId | null = null;
  private selectedPatch: EntityId | null = null;
  private selectedGround: EntityId | null = null;
  private selectedPoi: EntityId | null = null;
  private selectedSwamp: Tile | null = null;
  private workersOpen = false;
  private lastSpeed: Speed = 1;
  private hud: HudState = {
    ready: false,
    speed: 1,
    tool: null,
    day: 1,
    season: '',
    dayOfSeason: 1,
    year: 1,
    dayTrack: { phase: 'day', progress: 0, duskAt: 1 },
    villagers: 0,
    goods: {},
    homeless: 0,
    hungry: 0,
    cold: 0,
    food: 0,
    treasury: 0,
    carriersBusy: utilizationText(null),
    carriersBusyPercent: null,
    heatMap: false,
    winter: null,
    alerts: [],
    deathLog: [],
    gameOver: null,
    pile: null,
    villager: null,
    building: null,
    patch: null,
    ground: null,
    poi: null,
    swamp: null,
    placementWarning: null,
    placementNote: null,
    workers: null,
    loadMenu: null,
    heroSelected: false,
    monsterRate: DEFAULT_MONSTER_RATE,
    fog: false,
    heroLoad: null,
    heroKnockout: null,
    heroHp: null,
    bell: null,
    rank: { rank: '', next: null },
    locks: {},
    message: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly abort = new AbortController();
  private cameraCentred = false;
  /** What the last new game started from. */
  private lastSetup: NewGameSetup = FIRST_GAME;

  private constructor() {
    this.bridge = new SimBridge({
      onSnapshot: (state) => this.onSnapshot(state),
      onSaved: (json, slot, tick) => this.onSaved(json, slot, tick),
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
    const lock = this.lockOf(tool);
    if (lock) {
      this.setHud({ message: lockText(lock) });
      return;
    }
    this.dragStart = null;
    this.clearSelection();
    // The build menu shows the tool's hint.
    this.setHud({ tool, message: null });
    this.updateGhost();
  }

  /**
   * Takes up a panel's tool `tool` (the woodcutter's hut's tree tools, the farm's Field tools),
   * keeping the building selected so its panel stays open; puts it down again if it's in hand.
   */
  togglePanelTool(tool: ToolId): void {
    this.dragStart = null;
    this.setHud({ tool: this.hud.tool === tool ? null : tool, message: null });
    this.updateGhost();
  }

  /** What the rank keeps `tool` from, or null when it isn't a building or isn't locked. */
  private lockOf(tool: ToolId): RankLock | null {
    return tool in content.buildings ? (this.hud.locks[tool as BuildingId] ?? null) : null;
  }

  /** Leaves the current tool and clears any selection. */
  cancelTool(): void {
    this.dragStart = null;
    this.clearSelection();
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

  /** Opens or closes the workers view. */
  toggleWorkers(): void {
    this.workersOpen = !this.workersOpen;
    const state = this.bridge.state;
    if (state) this.refreshWorkers(state);
    else this.setHud({ workers: null });
  }

  /** Shows or hides the road heat-map. */
  toggleHeatMap(): void {
    const on = !this.hud.heatMap;
    this.renderer.setHeatMap(on);
    this.setHud({ heatMap: on });
  }

  /** Selects villager `id`, as clicking it would. */
  focusVillager(id: EntityId): void {
    this.selectHero(false);
    this.selectPile(null);
    this.selectBuilding(null);
    this.selectVillager(id);
  }

  /**
   * Selects the Hero, as clicking it would (putting down any tool), and centres the camera on it:
   * the Hero button and key 1.
   */
  focusHero(): void {
    const state = this.bridge.state;
    const id = state ? heroOf(state) : null;
    const at = state && id !== null ? state.components.position[id] : undefined;
    if (!at) return;
    this.cancelTool();
    this.selectHero(true);
    const g = unitsToGrid(at);
    const c = gridToWorld(g.x, g.y);
    this.camera.x = c.x;
    this.camera.y = c.y;
  }

  /** Moves the camera to an alert's target tile. */
  focusAlert(target: Tile): void {
    const c = gridToWorld(target.x + 0.5, target.y + 0.5);
    this.camera.x = c.x;
    this.camera.y = c.y;
  }

  unassignWorker(villager: EntityId): void {
    this.bridge.command({ type: 'unassignWorker', villager });
  }

  reassignWorker(villager: EntityId, workplace: EntityId): void {
    this.bridge.command({ type: 'reassignWorker', villager, workplace });
  }

  /** Sets the selected hunter's lodge to hunt only `ground`, or with null the nearest with Game. */
  setHuntingGround(ground: EntityId | null): void {
    const id = this.selectedBuilding;
    if (id === null) return;
    this.bridge.command({ type: 'setHuntingGround', building: id, ground });
  }

  /** Picks the Crop the selected farm sows from the next spring on. */
  setCrop(crop: CropId): void {
    const id = this.selectedBuilding;
    if (id === null) return;
    this.bridge.command({ type: 'setCrop', building: id, crop });
  }

  /** Raises or lowers the selected Workplace's worker limit by `delta`. */
  changeWorkerLimit(delta: number): void {
    const id = this.selectedBuilding;
    const info = this.hud.building;
    if (id === null || !info) return;
    this.bridge.command({ type: 'setWorkerLimit', building: id, limit: info.workerLimit + delta });
  }

  /** Raises or lowers the selected Workplace's standing order by `delta`, within 0 and the most. */
  changeStandingOrder(delta: number): void {
    const id = this.selectedBuilding;
    const order = this.hud.building?.standingOrder;
    if (id === null || !order) return;
    const amount = Math.min(MAX_STANDING_ORDER, Math.max(0, order.amount + delta));
    this.bridge.command({ type: 'setStandingOrder', building: id, amount });
  }

  /**
   * Sells `resource` at the trade post, keeping its standing-order default in the village to
   * start with, or with null stops selling it.
   */
  toggleSellRule(resource: ResourceId): void {
    const row = this.hud.building?.tradePost?.goods.find((g) => g.resource === resource);
    const keep = row?.keep === null ? (content.resources[resource].standingOrder ?? 20) : null;
    this.bridge.command({ type: 'setSellRule', resource, keep });
  }

  /** Raises or lowers what the trade post's rule for `resource` keeps, within 0 and the most. */
  changeSellRule(resource: ResourceId, delta: number): void {
    const keep = this.hud.building?.tradePost?.goods.find((g) => g.resource === resource)?.keep;
    if (keep === null || keep === undefined) return;
    const amount = Math.min(MAX_SELL_KEEP, Math.max(0, keep + delta));
    this.bridge.command({ type: 'setSellRule', resource, keep: amount });
  }

  /** Starts a new game from `setup` (by default the last game's again), replacing this one. */
  newGame(setup: NewGameSetup = this.lastSetup): void {
    this.lastSetup = setup;
    this.cameraCentred = false;
    this.bridge.newGame(setup);
    this.dragStart = null;
    this.clearSelection();
    this.setHud({ tool: null, pile: null, message: null });
    this.updateGhost();
  }

  save(): void {
    this.bridge.save();
  }

  /** Rings the Militia bell: calls every villager to arms, or stands them down. */
  ringBell(): void {
    this.bridge.command({ type: 'ringBell' });
  }

  /** Dev: sets this game's Monster rate (0 turns nights off). */
  setMonsterRate(rate: number): void {
    this.bridge.command({ type: 'setMonsterRate', rate });
  }

  /** Dev: turns Fog on or off in the running game (what's Revealed is kept). */
  setFog(on: boolean): void {
    this.bridge.command({ type: 'setFog', on });
  }

  /** Opens or closes the Load menu, listing each slot with the date it was saved on. */
  toggleLoadMenu(): void {
    if (this.hud.loadMenu) {
      this.setHud({ loadMenu: null });
      return;
    }
    const menu = (Object.keys(SAVE_SLOTS) as SaveSlot[]).map((slot) => {
      const tick = savedTick(readSlot(slot));
      return {
        slot,
        name: SAVE_SLOTS[slot].name,
        date: tick === null ? null : slotDateLabel(tick, content),
      };
    });
    this.setHud({ loadMenu: menu });
  }

  load(slot: SaveSlot): void {
    const json = readSlot(slot);
    this.setHud({ loadMenu: null });
    if (!json) {
      this.setHud({ message: `No ${SAVE_SLOTS[slot].name.toLowerCase()} found.` });
      return;
    }
    // The save may be on another map, so centre the camera on it.
    this.cameraCentred = false;
    this.bridge.load(json);
    this.dragStart = null;
    this.clearSelection();
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
          this.pointer = { sx, sy };
          this.updateGhost();
        },
        onLeave: () => {
          this.hover = null;
          this.pointer = null;
          this.updateGhost();
        },
        onClick: (sx, sy, button, shiftKey) => this.onClick(sx, sy, button, shiftKey),
        onToolDown: (sx, sy) => this.onToolDown(sx, sy),
        onToolUp: (sx, sy) => this.onToolUp(sx, sy),
      },
    );
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.abort.signal });
    this.renderer.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
    this.newGame();
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
      this.renderer.drawNight(nightLook(state.tick, content));
    }
    this.updateCursor();
  }

  /**
   * While the hero is selected and up, shows the attack cursor over a Gloamling or a Den and the
   * Search cursor over Ruins it would Search. Checked every frame, as Gloamlings move under a
   * still mouse.
   */
  private updateCursor(): void {
    const state = this.bridge.state;
    const hero = state ? heroOf(state) : null;
    let cursor: HeroCursor = '';
    if (
      state !== null &&
      hero !== null &&
      this.hud.heroSelected &&
      this.hud.tool === null &&
      this.pointer !== null &&
      !isKnockedOut(state, hero)
    ) {
      const tile = this.tileAt(this.pointer.sx, this.pointer.sy);
      if (
        this.renderer.hitGloamling(this.pointer.sx, this.pointer.sy) !== null ||
        this.seenDenAt(state, tile)
      ) {
        cursor = 'crosshair';
      } else if (this.searchAt(state, tile)) {
        cursor = 'zoom-in';
      }
    }
    if (cursor === this.cursor) return;
    this.cursor = cursor;
    this.renderer.canvas.style.cursor = cursor;
  }

  /**
   * Whether right-clicking `tile` would order the hero to Search (the sim's `heroOrderAt`), worked
   * out again only when the state or the tile changes.
   */
  private searchAt(state: GameState, tile: Tile): boolean {
    const last = this.searchUnder;
    if (last && last.state === state && last.tile.x === tile.x && last.tile.y === tile.y) {
      return last.search;
    }
    const search = heroOrderAt(state, content, tile)?.order === 'search';
    this.searchUnder = { state, tile, search };
    return search;
  }

  /** Whether a Den the player can see (on a Revealed tile) is on `tile`. */
  private seenDenAt(state: GameState, tile: Tile): boolean {
    return isRevealed(state, tile) && denAt(state, tile) !== null;
  }

  private onSnapshot(state: GameState): void {
    if (!this.cameraCentred) {
      const camp = campCentre(state, content);
      const c = gridToWorld(camp.x, camp.y);
      this.camera.x = c.x;
      this.camera.y = c.y;
      this.cameraCentred = true;
    }
    this.renderer.syncStatics(state);
    this.refreshPile(state);
    this.refreshVillager(state);
    this.refreshBuilding(state);
    this.refreshPatch(state);
    this.refreshGround(state);
    this.refreshPoi(state);
    this.refreshSwamp(state);
    this.refreshWorkers(state);
    this.updateGhost();
    if (this.hud.heroSelected && heroOf(state) === null) {
      this.selectHero(false); // a new game or a load without a hero
    }

    const time = calendarAt(state.tick, content);
    const villagers = Object.values(state.components.villager);
    const busy = carrierUtilization(state, content);
    const track = dayTrack(state.tick, content);
    const goods = stockpileGoods(state);
    const hp = heroHp(state);
    this.setHud({
      ready: true,
      heroLoad: heroLoadLabel(state),
      heroKnockout: heroKnockoutLabel(state),
      heroHp: sameJson(hp, this.hud.heroHp) ? this.hud.heroHp : hp,
      day: time.day,
      season: seasonName(time.season, content),
      dayOfSeason: time.dayOfSeason,
      year: time.year,
      dayTrack: sameJson(track, this.hud.dayTrack) ? this.hud.dayTrack : track,
      villagers: villagers.length,
      goods: sameJson(goods, this.hud.goods) ? this.hud.goods : goods,
      homeless: villagers.filter((v) => v.home === null).length,
      hungry: villagers.filter((v) => v.missedMeals > 0).length,
      cold: villagers.filter((v) => v.coldNights > 0).length,
      food: villageFood(state, content),
      treasury: treasuryCoin(state),
      carriersBusy: utilizationText(busy),
      carriersBusyPercent: busy,
      gameOver: state.gameOver && gameOverText(state.gameOver),
      monsterRate: state.monsterRate,
      fog: state.fog,
    });
    this.refreshRank(state);
    const bell = bellOf(state, content) === null ? null : { ringing: isBellRung(state) };
    if (JSON.stringify(bell) !== JSON.stringify(this.hud.bell)) this.setHud({ bell });
    this.refreshAlerts(state);
  }

  /** The rank line and the build menu's locks; each changes only when its words do. */
  private refreshRank(state: GameState): void {
    const rank = rankText(rankProgress(state, content));
    const locks: Partial<Record<BuildingId, RankLock>> = {};
    for (const type of Object.keys(content.buildings) as BuildingId[]) {
      const lock = rankLock(state, content, type);
      if (lock) locks[type] = lock;
    }
    if (!sameJson(rank, this.hud.rank)) this.setHud({ rank });
    if (!sameJson(locks, this.hud.locks)) this.setHud({ locks });
  }

  /** Alerts, the winter countdown and the death log. Lists only change when their text does. */
  private refreshAlerts(state: GameState): void {
    const list: AlertView[] = alerts(state, content).map((alert) => ({
      kind: alert.kind,
      severity: alert.severity,
      text: alertText(alert),
      target: alert.target,
    }));
    const log = state.deaths.slice(-DEATH_LOG_LENGTH).reverse().map(deathText);
    const days = winterIn(state, content);
    this.setHud({
      winter: days === null ? null : winterText(days),
      alerts: sameJson(list, this.hud.alerts) ? this.hud.alerts : list,
      deathLog: sameJson(log, this.hud.deathLog) ? this.hud.deathLog : log,
    });
  }

  private onSaved(json: string, slot: SaveSlot, tick: number): void {
    try {
      localStorage.setItem(SAVE_SLOTS[slot].key, json);
      // Autosaves happen quietly, once a day.
      if (slot === 'manual') this.setHud({ message: `Saved on ${slotDateLabel(tick, content)}.` });
    } catch (error) {
      this.setHud({ message: `${SAVE_SLOTS[slot].name} failed: ${String(error)}` });
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
      const { rotation } = this;
      if (!canPlaceBuilding(state, content, tool, tile.x, tile.y, rotation)) {
        const lock = rankLock(state, content, tool);
        this.setHud({ message: lock ? lockText(lock) : "Can't build there." });
        return;
      }
      this.bridge.command({ type: 'placeBuilding', building: tool, ...tile, rotation });
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
    if (isWallTool(tool)) {
      if (canLayWall(state, content, tool, from, to)) {
        this.bridge.command({ type: 'layWall', building: tool, from, to });
      } else this.setHud({ message: "Can't build there." });
    } else if (isGroundworkTool(tool)) {
      if (canLayGroundwork(state, content, tool, from, to)) {
        this.bridge.command({ type: 'layGroundwork', building: tool, from, to });
      } else this.setHud({ message: groundworkRefusal(tool) });
    } else if (tool === 'path') {
      if (canLayPath(state, content, from, to)) this.bridge.command({ type: 'layPath', from, to });
      else this.setHud({ message: "Can't lay a path there." });
    } else if (tool === 'removePath') {
      this.bridge.command({ type: 'removePath', from, to });
    } else if (tool === 'fellTrees') {
      if (canMark(state, from, to)) this.bridge.command({ type: 'markTrees', from, to });
      else this.setHud({ message: "Can't mark trees where you haven't looked yet." });
    } else if (tool === 'reserve') {
      if (canPaintReserve(state, from, to)) this.bridge.command({ type: 'paintReserve', from, to });
      else this.setHud({ message: "Can't mark a Reserve where you haven't looked yet." });
    } else if (tool === 'digStumps') {
      if (canMark(state, from, to)) this.bridge.command({ type: 'markStumps', from, to });
      else this.setHud({ message: "Can't mark Stumps where you haven't looked yet." });
    } else if (tool === 'eraseMarks') {
      this.bridge.command({ type: 'eraseReserve', from, to });
      this.bridge.command({ type: 'clearMarks', from, to });
    } else if (tool === 'paintFields') {
      const farm = this.selectedBuilding;
      if (farm !== null && this.fieldTiles(state, from, to).length > 0) {
        this.bridge.command({ type: 'paintFields', farm, from, to });
      } else this.setHud({ message: "No open meadow in the farm's reach there." });
    } else if (tool === 'eraseFields') {
      this.bridge.command({ type: 'eraseFields', from, to });
    } else if (tool === 'stockpile') {
      const r = rect(from, to);
      if (canPlaceStockpile(state, content, r.x, r.y, r.w, r.h))
        this.bridge.command({ type: 'placeStockpile', ...r });
      else this.setHud({ message: "Can't place a stockpile there." });
    }
  }

  /**
   * Clicks with no tool. Left-click selects the hero if it's under the cursor, else a villager,
   * else the stockpile there, else the Workplace there, else the forage patch there, else the
   * point of interest there, else the Hunting ground there (or nothing). Right-click orders the
   * selected hero, RTS style.
   */
  private onSelectClick(sx: number, sy: number, button: number): void {
    const state = this.bridge.state;
    if (!state) return;
    if (button === 0) {
      const hero = this.renderer.hitHero(sx, sy);
      const villager = hero ? null : this.renderer.hitVillager(sx, sy);
      const tile = this.tileAt(sx, sy);
      // Under Fog, an unrevealed tile has nothing on it to select.
      const hidden = !isRevealed(state, tile);
      const pile = hero || villager !== null || hidden ? null : stockpileAt(state, tile);
      const unit = hero || villager !== null || pile !== null || hidden;
      this.selectHero(hero);
      this.selectVillager(villager);
      this.selectPile(pile);
      const workplace = unit ? null : inspectableAt(state, tile);
      this.selectBuilding(workplace);
      const patch = unit || workplace !== null ? null : patchAt(state, tile);
      this.selectPatch(patch);
      const poi = unit || workplace !== null || patch !== null ? null : poiAt(state, tile);
      this.selectPoi(poi);
      const taken = unit || workplace !== null || patch !== null || poi !== null;
      const ground = taken ? null : groundAt(state, tile);
      this.selectGround(ground);
      // A bare tile that holds bog iron.
      const swamp = taken || ground !== null || oreCap(state, content, tile) === 0;
      this.selectSwamp(swamp ? null : tile);
    } else if (button === 2 && this.hud.heroSelected) {
      const hero = heroOf(state);
      if (hero !== null && isKnockedOut(state, hero)) {
        this.setHud({ message: 'The hero is Knocked out.' });
        return;
      }
      // A Gloamling drawn under the mouse, even over another tile, is the one to attack.
      const gloamling = this.renderer.hitGloamling(sx, sy);
      const order: HeroOrder | null =
        gloamling !== null
          ? { order: 'attack', gloamling }
          : heroOrderAt(state, content, this.tileAt(sx, sy));
      if (order) this.bridge.command({ type: 'orderHero', ...order });
      else this.setHud({ message: 'Nothing for the hero to do there.' });
    }
  }

  private selectHero(selected: boolean): void {
    this.renderer.setHeroSelected(selected);
    this.setHud({
      heroSelected: selected,
      message: selected
        ? 'Hero selected. Right-click to walk, chop a tree, carry goods, Search Ruins by day, or attack a Gloamling or a Den. Esc deselects.'
        : null,
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return; // typing in a field (the dev seed)
    const action = keyAction(e.key);
    if (!action) return;
    // Space would scroll or press the focused button; F1–F3 would open the browser's help or
    // search.
    if (action.kind === 'pause' || action.kind === 'speed') e.preventDefault();
    if (action.kind === 'cancel') this.cancelTool();
    else if (action.kind === 'pause') this.togglePause();
    else if (action.kind === 'speed') this.setSpeed(action.speed);
    else if (action.kind === 'hero') this.focusHero();
    else if (action.kind === 'workers') this.toggleWorkers();
    else if (action.kind === 'heatMap') this.toggleHeatMap();
    else if (action.kind === 'turn') this.turnBuilding(action.quarters);
    else this.selectTool(action.tool);
  }

  /** Turns the building being placed `quarters` quarter turns clockwise (3 is one anticlockwise). */
  private turnBuilding(quarters: 1 | 3): void {
    const tool = this.hud.tool;
    if (!tool || !isBuilding(tool)) return;
    this.rotation = ((this.rotation + quarters) % 4) as Rotation;
    this.updateGhost();
  }

  private tileAt(sx: number, sy: number): { x: number; y: number } {
    return screenToTile(sx, sy, this.camera, this.renderer.screenWidth, this.renderer.screenHeight);
  }

  /**
   * Deselects the hero, villager, stockpile, Workplace, patch, point of interest, ground and
   * Swamp tile, whichever is selected.
   */
  private clearSelection(): void {
    this.selectPile(null);
    this.selectBuilding(null);
    this.selectPatch(null);
    this.selectPoi(null);
    this.selectGround(null);
    this.selectSwamp(null);
    this.selectVillager(null);
    this.selectHero(false);
  }

  private selectPile(id: EntityId | null): void {
    this.selectedPile = id;
    const state = this.bridge.state;
    if (state) this.refreshPile(state);
    this.updateGhost();
  }

  private selectVillager(id: EntityId | null): void {
    this.selectedVillager = id;
    this.renderer.setSelectedVillager(id);
    const state = this.bridge.state;
    if (state) this.refreshVillager(state);
    else this.setHud({ villager: null });
  }

  /** Copies the selected villager into the HUD, or deselects it once it's gone. */
  private refreshVillager(state: GameState): void {
    const id = this.selectedVillager;
    const info = id === null ? null : villagerInfo(state, id);
    if (id !== null && !info) {
      this.selectedVillager = null;
      this.renderer.setSelectedVillager(null);
    }
    if (JSON.stringify(info) !== JSON.stringify(this.hud.villager)) this.setHud({ villager: info });
  }

  private selectBuilding(id: EntityId | null): void {
    this.selectedBuilding = id;
    const state = this.bridge.state;
    if (state) this.refreshBuilding(state);
    else this.setHud({ building: null });
    this.updateGhost();
  }

  /** Copies the selected building into the HUD, or deselects it once it's gone. */
  private refreshBuilding(state: GameState): void {
    const id = this.selectedBuilding;
    const info = id === null ? null : buildingInfo(state, id);
    if (id !== null && !info) this.selectedBuilding = null;
    if (JSON.stringify(info) !== JSON.stringify(this.hud.building)) this.setHud({ building: info });
  }

  private selectPatch(id: EntityId | null): void {
    this.selectedPatch = id;
    const state = this.bridge.state;
    if (state) this.refreshPatch(state);
    else this.setHud({ patch: null });
  }

  /** Copies the selected forage patch into the HUD. */
  private refreshPatch(state: GameState): void {
    const id = this.selectedPatch;
    const info = id === null ? null : patchInfo(state, id);
    if (id !== null && !info) this.selectedPatch = null;
    if (JSON.stringify(info) !== JSON.stringify(this.hud.patch)) this.setHud({ patch: info });
  }

  private selectPoi(id: EntityId | null): void {
    this.selectedPoi = id;
    const state = this.bridge.state;
    if (state) this.refreshPoi(state);
    else this.setHud({ poi: null });
  }

  /** Copies the selected point of interest into the HUD. */
  private refreshPoi(state: GameState): void {
    const id = this.selectedPoi;
    const info = id === null ? null : poiInfo(state, id);
    if (id !== null && !info) this.selectedPoi = null;
    if (JSON.stringify(info) !== JSON.stringify(this.hud.poi)) this.setHud({ poi: info });
  }

  private selectSwamp(tile: Tile | null): void {
    this.selectedSwamp = tile;
    const state = this.bridge.state;
    if (state) this.refreshSwamp(state);
    else this.setHud({ swamp: null });
  }

  /** Copies the selected Swamp tile's bog iron into the HUD, or deselects it once Drained. */
  private refreshSwamp(state: GameState): void {
    const tile = this.selectedSwamp;
    const info = tile === null ? null : swampInfo(state, tile);
    if (tile !== null && !info) this.selectedSwamp = null;
    if (JSON.stringify(info) !== JSON.stringify(this.hud.swamp)) this.setHud({ swamp: info });
  }

  private selectGround(id: EntityId | null): void {
    this.selectedGround = id;
    const state = this.bridge.state;
    if (state) this.refreshGround(state);
    else this.setHud({ ground: null });
    this.updateGhost();
  }

  /** Copies the selected Hunting ground into the HUD. */
  private refreshGround(state: GameState): void {
    const id = this.selectedGround;
    const info = id === null ? null : groundInfo(state, id);
    if (id !== null && !info) this.selectedGround = null;
    if (JSON.stringify(info) !== JSON.stringify(this.hud.ground)) this.setHud({ ground: info });
  }

  /** Copies every villager into the workers view while it's open. */
  private refreshWorkers(state: GameState): void {
    const view = this.workersOpen ? workersView(state) : null;
    if (JSON.stringify(view) !== JSON.stringify(this.hud.workers)) this.setHud({ workers: view });
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

  /**
   * The tool's preview under the cursor, or else the selected stockpile, Workplace or Hunting
   * ground highlighted.
   */
  private updateGhost(): void {
    const state = this.bridge.state;
    const tool = this.hud.tool;
    this.renderer.setShownGrounds(state ? this.shownGrounds(state, tool) : []);
    const hover = this.hover;
    const placing = state && tool && hover && isBuilding(tool) ? { state, tool, hover } : null;
    const from = this.dragStart ?? hover;
    this.setHud({
      placementWarning:
        placing && from
          ? placementWarning(placing.state, placing.tool, from, placing.hover, this.rotation)
          : null,
      placementNote: placing
        ? placementNote(placing.state, placing.tool, placing.hover, this.rotation)
        : null,
    });
    if (state && tool && this.hover) {
      this.renderer.setGhost(this.ghostFor(state, tool, this.hover));
      return;
    }
    const ground =
      this.selectedGround === null
        ? undefined
        : state?.components.huntingGround[this.selectedGround];
    if (state && ground) {
      const tiles = groundTiles(state, ground);
      this.renderer.setGhost({ kind: 'tiles', tiles, valid: true });
      return;
    }
    const building = this.selectedBuilding;
    const layout = building === null || !state ? null : entityLayout(state, content, building);
    if (layout) {
      this.renderer.setGhost({ kind: 'tiles', tiles: layout.tiles, valid: true });
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

  /**
   * The Hunting grounds to outline: all of them while placing a building that hunts or fells the
   * forest, the selected ground, or those a selected hunter's lodge reaches; else none.
   */
  private shownGrounds(state: GameState, tool: ToolId | null): EntityId[] {
    const def = tool && isBuilding(tool) ? content.buildings[tool] : undefined;
    if (def && (def.hunts || def.gathers?.includes(content.hunting.forest))) {
      return idsOf(state.components.huntingGround);
    }
    if (this.selectedGround !== null) return [this.selectedGround];
    const building = this.selectedBuilding;
    const type = building === null ? undefined : state.components.building[building]?.type;
    return building !== null && type && content.buildings[type].hunts
      ? groundsInReach(state, content, building)
      : [];
  }

  /** The tiles of the rectangle `from`–`to` the selected farm may paint as Fields. */
  private fieldTiles(state: GameState, from: Tile, to: Tile): Tile[] {
    const farm = this.selectedBuilding;
    if (farm === null) return [];
    return reserveRect(from, to).filter((t) => canBeField(state, content, farm, t));
  }

  private ghostFor(state: GameState, tool: ToolId, hover: Tile): PlacementGhost {
    const { x, y } = hover;
    if (isWallTool(tool)) {
      const from = this.dragStart ?? hover;
      return {
        kind: 'tiles',
        tiles: lShapeTiles(from, hover),
        valid: canLayWall(state, content, tool, from, hover),
        darkRing: darkRingTiles(state, content),
      };
    }
    if (isGroundworkTool(tool)) {
      const from = this.dragStart ?? hover;
      return {
        kind: 'tiles',
        tiles: lShapeTiles(from, hover),
        valid: canLayGroundwork(state, content, tool, from, hover),
      };
    }
    if (isBuilding(tool)) {
      const { rotation } = this;
      return {
        kind: 'building',
        type: tool,
        x,
        y,
        rotation,
        valid: canPlaceBuilding(state, content, tool, x, y, rotation),
        darkRing: darkRingTiles(state, content),
        reserve: reserveNear(state, content, tool, hover, rotation),
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
      case 'reserve':
        return {
          kind: 'tiles',
          tiles: reserveRect(from, hover),
          valid: canPaintReserve(state, from, hover),
        };
      case 'fellTrees':
      case 'digStumps':
        return {
          kind: 'tiles',
          tiles: reserveRect(from, hover),
          valid: canMark(state, from, hover),
        };
      case 'eraseMarks':
      case 'eraseFields':
        return { kind: 'tiles', tiles: reserveRect(from, hover), valid: true };
      case 'paintFields': {
        const tiles = this.fieldTiles(state, from, hover);
        return tiles.length > 0
          ? { kind: 'tiles', tiles, valid: true }
          : { kind: 'tiles', tiles: reserveRect(from, hover), valid: false };
      }
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

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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

/**
 * The building with a panel covering `tile`, if any: a Workplace (it employs anyone), one that
 * keeps Storage (a Granary, the trade post), or the notice board.
 */
function inspectableAt(state: GameState, tile: Tile): EntityId | null {
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    if (!b) continue;
    const panel =
      maxWorkers(content, b.type) > 0 ||
      storageOf(state, content, id) !== null ||
      content.buildings[b.type].noticeBoard === true;
    if (!panel) continue;
    if (onFootprint(state, id, tile)) return id;
  }
  return null;
}

/** Whether `tile` is one of building or site `id`'s footprint tiles, its yard included. */
function onFootprint(state: GameState, id: EntityId, tile: Tile): boolean {
  const tiles = entityLayout(state, content, id)?.tiles ?? [];
  return tiles.some((t) => t.x === tile.x && t.y === tile.y);
}

/** The forage patch on `tile`, if any. */
function patchAt(state: GameState, tile: Tile): EntityId | null {
  const { tile: at } = state.components;
  for (const id of idsOf(state.components.mapObject)) {
    const t = at[id];
    if (t && t.x === tile.x && t.y === tile.y && isForagePatch(state, content, id)) return id;
  }
  return null;
}

/** Forage patch `id`'s name, stock and shade for the panel, or null if it's gone. */
function patchInfo(state: GameState, id: EntityId): PatchInfo | null {
  const obj = state.components.mapObject[id];
  const def = obj ? content.mapObjects[obj.type] : undefined;
  if (!obj || !def?.forage) return null;
  const withered = isWithered(state, content, id);
  const food = content.resources[def.resource].name.toLowerCase();
  return {
    name: def.name,
    resource: def.resource,
    stock: obj.amount > 0 && !withered ? `${obj.amount} ${food}` : 'Nothing to gather',
    noShade: withered
      ? `No shade: needs a tree within ${def.forage.shadeTiles} tiles to regrow`
      : null,
  };
}

/** Point of interest `id`'s name and what it is for the panel, or null if it's gone. */
function poiInfo(state: GameState, id: EntityId): PoiInfo | null {
  const poi = state.components.poi[id];
  if (!poi) return null;
  const def = content.pois[poi.kind];
  const info = { kind: poi.kind, name: def.name };
  if (def.search) {
    return poi.searched
      ? { ...info, sub: 'Searched', note: 'What it held was left on its tile.' }
      : {
          ...info,
          sub: 'Not yet Searched',
          note: 'Right-click it with the hero to Search it, by day.',
        };
  }
  if (def.wardTiles !== undefined) {
    return { ...info, sub: null, note: `No Den buds within ${def.wardTiles} tiles of it.` };
  }
  return { ...info, sub: null, note: 'An old mine over an iron Deposit, a Den at its mouth.' };
}

/** Hunting ground `id`'s name, health and Game for the panel, or null if it's gone. */
function groundInfo(state: GameState, id: EntityId): GroundInfo | null {
  const g = state.components.huntingGround[id];
  if (!g) return null;
  const health = groundHealth(g, content);
  const parts = [`Game ${g.game} / ${g.maxGame}`];
  if (g.fled > 0) parts.push(`${g.fled} fled due to logging`);
  // Whole percent, rounded down, from the sim's permille.
  parts.push(`catch chance ${Math.floor(huntChancePermille(g, content) / 10)}%`);
  const regrowth = groundRegrowth(state, content, g);
  return {
    id,
    name: g.name,
    health,
    word: HEALTH_WORDS[health],
    summary: parts.join(' · '),
    regrowth: regrowth && regrowthText(regrowth),
  };
}

/** Swamp tile `tile`'s bog iron for the panel, or null once it holds none (Drained). */
function swampInfo(state: GameState, tile: Tile): SwampInfo | null {
  const cap = oreCap(state, content, tile);
  const terrain = state.map.terrain[tile.y * state.map.width + tile.x];
  if (cap === 0 || !terrain) return null;
  return {
    name: content.terrain[terrain].name,
    ore: `Bog iron ${oreAt(state, content, tile)} / ${cap}`,
  };
}

/**
 * What placing a `type` building at `origin` would cost, if anything: one that fells the forest
 * warns when its radius reaches into a Hunting ground; groundwork laid from `from` that would turn
 * Swamp into Meadow (a Drain) says how much bog iron it loses.
 */
function placementWarning(
  state: GameState,
  type: BuildingId,
  from: Tile,
  origin: Tile,
  rotation: Rotation,
): string | null {
  const lost = bogIronLost(state, content, type, from, origin);
  if (lost > 0) return `Draining loses ${lost} bog iron for good.`;
  if (!content.buildings[type].gathers?.includes(content.hunting.forest)) return null;
  const names = groundsNear(state, content, type, origin, rotation).map(
    (id) => state.components.huntingGround[id]?.name ?? '',
  );
  if (names.length === 0) return null;
  return `Its radius reaches into ${names.join(' and ')}: felling trees there drives game away.`;
}

/** A plain note about placing a `type` building at `origin`: the bog iron a digger would reach. */
function placementNote(
  state: GameState,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation,
): string | null {
  if (!content.buildings[type].digsOre) return null;
  return `Bog iron in reach: ${bogIronNear(state, content, type, origin, rotation)}.`;
}

/**
 * Display names of every building, keyed by ID: the content name, numbered in ID order where a
 * village has several of a kind ("Woodcutter's hut 2").
 */
function buildingNames(state: GameState): Record<EntityId, string> {
  const { building } = state.components;
  const ids = idsOf(building);
  const names: Record<EntityId, string> = {};
  for (const id of ids) {
    const type = building[id]?.type;
    if (!type) continue;
    const same = ids.filter((other) => building[other]?.type === type);
    const name = content.buildings[type].name;
    names[id] = same.length > 1 ? `${name} ${same.indexOf(id) + 1}` : name;
  }
  return names;
}

/** What building `id`'s yard holds, or null without one. */
function yardInfo(state: GameState, id: EntityId): BuildingInfo['yard'] {
  const b = state.components.building[id];
  const output = b && content.buildings[b.type].outputBuffer;
  if (!b || !output) return null;
  return {
    amount: yardAmount(state, content, id),
    capacity: content.logistics.yardCapacity,
    goods: output.resources.map((resource) => ({ resource, amount: b.stock[resource] ?? 0 })),
  };
}

/** Building `id`'s name, workers, Storage and the rest for the panel, or null if it's gone. */
function buildingInfo(state: GameState, id: EntityId): BuildingInfo | null {
  const b = state.components.building[id];
  if (!b) return null;
  const { villager } = state.components;
  const status = workplaceStatus(state, content, id);
  return {
    type: b.type,
    name: buildingNames(state)[id] ?? content.buildings[b.type].name,
    yard: yardInfo(state, id),
    storage: storageOf(state, content, id),
    standingOrder: standingOrderOf(state, content, id),
    grounds: content.buildings[b.type].hunts
      ? groundsInReach(state, content, id).flatMap((g) => groundInfo(state, g) ?? [])
      : [],
    huntingGround: b.huntingGround ?? null,
    workers: workersAt(state, id).flatMap((w) => {
      const v = villager[w];
      if (!v) return [];
      return [
        {
          id: w,
          name: v.name,
          job: content.jobs[v.job].name,
          jobId: v.job,
          master: title(state, w),
        },
      ];
    }),
    workerLimit: b.workerLimit,
    maxWorkers: maxWorkers(content, b.type),
    status: status && workplaceStatusText(status),
    bell: content.buildings[b.type].bell !== undefined,
    treeTools: fellsTrees(content, b.type),
    farm: isFarm(state, content, id) ? farmInfo(state, id) : null,
    postings: content.buildings[b.type].noticeBoard
      ? postings(state, content).map((p) => postingView(p, state.tick))
      : null,
    tradePost: content.buildings[b.type].tradePost ? tradePostInfo(state) : null,
  };
}

/** The trade post's sell rules, prices, Wanted list and next Merchant, for its panel. */
function tradePostInfo(state: GameState): TradePostInfo {
  const trade = state.tradePost;
  const goods: SellRow[] = [];
  for (const resource of Object.keys(content.resources) as ResourceId[]) {
    const keep = trade.keep[resource] ?? null;
    const held = villageStock(state, content, resource);
    const wanted = trade.wanted?.includes(resource) ?? false;
    if (keep === null && held === 0 && !wanted) continue;
    goods.push({
      resource,
      keep,
      held,
      wanted,
      price: priceText(merchantPays(state, content, resource)),
    });
  }
  const today = calendarAt(state.tick, content).day;
  return {
    merchant: merchantText(today, nextMerchantDay(state, content), trade.merchantHere),
    wanted: trade.wanted,
    goods,
  };
}

/** Farm `id`'s Fields and Crops for its panel. */
function farmInfo(state: GameState, id: EntityId): FarmInfo {
  const fields = farmFields(state, content, id).map((t) => fieldAt(state, t));
  return {
    fields: fields.length,
    sown: fields.filter((f) => f?.stage === 'sown').length,
    ripe: fields.filter((f) => f?.stage === 'ripe').length,
    crop: farmCrop(state, content, id),
    nextCrop: farmNextCrop(state, content, id),
    crops: Object.values(content.crops).map((c) => ({ id: c.id, name: c.name })),
  };
}

/** Every villager in ID order for the workers view, with Carrier and worker counts. */
function workersView(state: GameState): WorkersView {
  const { villager } = state.components;
  const names = buildingNames(state);
  const rows: WorkerRow[] = [];
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v) continue;
    rows.push({
      id,
      name: v.name,
      job: content.jobs[v.job].name,
      jobId: v.job,
      master: title(state, id),
      workplace: v.workplace === null ? null : (names[v.workplace] ?? null),
      targets: reassignTargets(state, content, id).map((b) => ({ id: b, name: names[b] ?? '' })),
    });
  }
  const carriers = rows.filter((r) => r.workplace === null).length;
  return { carriers, workers: rows.length - carriers, rows };
}

/** Removes the stockpile, construction site or building on `tile`, in that order. */
function demolishCommand(state: GameState, tile: Tile): Command | null {
  const pile = stockpileAt(state, tile);
  if (pile !== null) return { type: 'removeStockpile', id: pile };
  const on = (id: EntityId) => onFootprint(state, id, tile);
  const site = idsOf(state.components.site).find(on);
  if (site !== undefined) return { type: 'cancelConstruction', siteId: site };
  const building = idsOf(state.components.building).find(on);
  if (building !== undefined) return { type: 'demolishBuilding', id: building };
  return null;
}

/**
 * Villager `id`'s name, Job, Workplace, Home, Tired, hunger and cold for the panel, or null if it's
 * gone.
 */
function villagerInfo(state: GameState, id: EntityId): VillagerInfo | null {
  const v = state.components.villager[id];
  if (!v) return null;
  const names = buildingNames(state);
  return {
    name: v.name,
    job: content.jobs[v.job].name,
    jobId: v.job,
    workplace: v.workplace === null ? null : (names[v.workplace] ?? null),
    home: v.home === null ? null : (names[v.home] ?? null),
    tired: v.tired,
    hunger: v.missedMeals > 0 ? hungerLabel(v.missedMeals) : null,
    cold: v.coldNights > 0 ? coldLabel(v.coldNights) : null,
    helpingCarry: isHelpingCarry(state, id),
    master: title(state, id),
  };
}

/** Villager `id`'s title as a Master ("Carpenter"), or null when it isn't one. */
function title(state: GameState, id: EntityId): string | null {
  const trade = masterOf(state, id);
  return trade === null ? null : content.trades[trade].name;
}

/** "1 cold night; freezes after 2". */
function coldLabel(coldNights: number): string {
  const nights = coldNights === 1 ? '1 cold night' : `${coldNights} cold nights`;
  return `${nights}; freezes after ${content.needs.cold.freezeAfterColdNights}`;
}

/** "2 days without food; dies after 3". */
function hungerLabel(missedMeals: number): string {
  const days = missedMeals === 1 ? '1 day' : `${missedMeals} days`;
  return `${days} without food; dies after ${content.needs.hungry.starveAfterMissedMeals}`;
}

/** What the hero holds, as "3/5 logs", or null if there's no hero. */
function heroLoadLabel(state: GameState): string | null {
  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  if (!hero) return null;
  const capacity = content.heroes[hero.type].carryCapacity;
  const goods = hero.carrying;
  if (!goods) return `0/${capacity}`;
  return `${goods.amount}/${capacity} ${content.resources[goods.resource].name.toLowerCase()}`;
}

/** The hero's hit points and its most, or null if there's no hero. */
function heroHp(state: GameState): { hp: number; max: number } | null {
  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  return hero ? { hp: hero.hp, max: content.combat.hero.hp } : null;
}

/** The hero's knockout countdown, or null when it's up or there's no hero. */
function heroKnockoutLabel(state: GameState): string | null {
  const id = heroOf(state);
  const until = id === null ? null : (state.components.hero[id]?.knockedOutUntil ?? null);
  if (until === null) return null;
  return knockoutText(until - state.tick, recoveryTile(state, content) !== null);
}

/** The save in `slot`, or null when there's none or storage can't be read. */
function readSlot(slot: SaveSlot): string | null {
  try {
    return localStorage.getItem(SAVE_SLOTS[slot].key);
  } catch {
    return null;
  }
}

/** The tick a save was made at, or null when there's no save or it can't be read. */
function savedTick(json: string | null): number | null {
  if (!json) return null;
  try {
    const tick: unknown = (JSON.parse(json) as { tick?: unknown }).tick;
    return typeof tick === 'number' ? tick : null;
  } catch {
    return null;
  }
}
