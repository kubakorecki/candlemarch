// Draws sim snapshots with PixiJS. Reads state only; all game rules stay in the sim.
import type { BuildingId, Content, JobId, ResourceAmount, ResourceId } from '@candlemarch/content';
import {
  boostedWorkplaces,
  buildingLayout,
  type EntityId,
  foodIds,
  type GameState,
  type GroundHealth,
  groundHealth,
  groundMiddle,
  groundTiles,
  type HealthBar,
  type HuntingGroundComponent,
  hasTile,
  healthBars,
  heroOf,
  heroSearch,
  idsOf,
  isBellRung,
  isBrokenWall,
  isColdHouse,
  isDarkLight,
  isIndoors,
  isInSight,
  isKnockedOut,
  isRevealed,
  isRiverFrozen,
  lightSources,
  type Point,
  type Rotation,
  roadTraffic,
  type Tile,
  tileOfPoint,
  type WorkplaceStatus,
  workplaceStatus,
} from '@candlemarch/sim';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { drawBuilding, drawWindowLight } from './buildingArt';
import { FogLayer } from './fogLayer';
import {
  type CameraView,
  depthOf,
  gridToWorld,
  overlaps,
  type Rect,
  TILE_H,
  TILE_W,
  tileAreaBounds,
  tileCenterWorld,
  unitsToGrid,
  viewRect,
  worldOriginOnScreen,
} from './iso';
import { GroundLayer, MapObjectLayer } from './mapLayers';
import type { NightLook } from './night';
import { palette } from './palette';
import {
  drawAbandonedMine,
  drawAuraRadius,
  drawAxe,
  drawBell,
  drawBoostedMark,
  drawBrokenWall,
  drawCache,
  drawCarriedGoods,
  drawChoppingBlock,
  drawDarkRing,
  drawDen,
  drawDizzyStars,
  drawFledPuff,
  drawGate,
  drawGloamling,
  drawGloamlingEyes,
  drawGoodsStack,
  drawGroundworkSite,
  drawHealthBar,
  drawHeatMap,
  drawHero,
  drawHeroFallen,
  drawHeroLoad,
  drawHuntingGround,
  drawLight,
  drawLightPool,
  drawMissingIcon,
  drawNoFirewoodIcon,
  drawOutputFullIcon,
  drawPalisade,
  drawPileGround,
  drawPlacementGhost,
  drawProgressBar,
  drawReserve,
  drawRoads,
  drawRuins,
  drawSelectionRing,
  drawShrine,
  drawSite,
  drawTileGhost,
  drawVillagerStatus,
  drawWaitingIcon,
  drawWallSite,
  drawWatchtower,
  HEAT_LEVELS,
  type HeatTile,
  type RoadTile,
  type WallArms,
} from './shapes';
import { drawVillager, drawVillagerTool } from './villagerArt';

/**
 * A building, site, Den, cache, point of interest or stockpile tile, redrawn only when what it
 * shows changes.
 */
interface StaticView {
  node: Container;
  graphics: Graphics;
  label?: Text;
  /** Summary of the drawn data; a different key means redraw. */
  key: string;
  /** World area it may draw in, for culling. */
  bounds: Rect;
  /** False while Fog hides it: none of its tiles is Revealed. */
  shown: boolean;
}

/** How far art may reach over a static's footprint: the tallest building and its status icon. */
const STATIC_ABOVE = TILE_H * 5;

/** World area a static on the `w`×`h` tiles from (x, y) may draw in: art, icons and site labels. */
function staticBounds(x: number, y: number, w: number, h: number): Rect {
  const b = tileAreaBounds(x, y, w, h, STATIC_ABOVE);
  return { ...b, minX: b.minX - TILE_W / 2, maxX: b.maxX + TILE_W / 2 };
}

/** World area a walker standing on world point (x, y) may draw in: figure, icons, bars. */
function walkerBounds(x: number, y: number): Rect {
  return { minX: x - TILE_W / 2, minY: y - TILE_H * 3, maxX: x + TILE_W / 2, maxY: y + TILE_H / 2 };
}

/** World pixels round the screen still counted as on it, so nothing pops in at the edge. */
const VIEW_MARGIN = TILE_W / 2;

/** Outline and word colour for each Hunting ground health. */
export const HEALTH_COLORS: Record<GroundHealth, number> = {
  thriving: palette.thriving,
  thinning: palette.thinning,
  scarce: palette.scarce,
  empty: palette.empty,
};

/** Health words as the player reads them. */
export const HEALTH_WORDS: Record<GroundHealth, string> = {
  thriving: 'Thriving',
  thinning: 'Thinning',
  scarce: 'Scarce',
  empty: 'Empty',
};

/** How long a "fled" puff lasts, in ms. */
const PUFF_MS = 1400;

/** Game fleeing a ground: where, its "N fled" label, and when it started (null until drawn). */
interface Puff {
  x: number;
  y: number;
  startMs: number | null;
  label: Text;
}

interface VillagerView {
  node: Container;
  /** Selection ring on the ground under the feet. */
  ring: Graphics;
  body: Graphics;
  /** The Job `body` is dressed for, so it's redrawn when a Carrier is drafted. */
  bodyJob: JobId;
  /** The Job's tool in hand, hidden while the axe swings. */
  tool: Graphics;
  /** What the villager carries, over its head. */
  load: Graphics;
  /** The resource `load` shows, so it's redrawn only when that changes. */
  loadDrawn: ResourceId | null;
  axe: Graphics;
  /** Homeless and Tired icons over its head. */
  status: Graphics;
  /** The icons `status` shows, so it's redrawn only when they change. */
  statusDrawn: string;
}

interface HeroView {
  node: Container;
  /** The figure; bobs while walking. */
  body: Graphics;
  /** Selection ring on the ground under the feet. */
  ring: Graphics;
  /** The hero lying where it fell, shown instead of `body` while it's Knocked out. */
  fallen: Graphics;
  /** Stars circling over the fallen hero's head. */
  dizzy: Graphics;
  /** Swings while the hero chops. */
  axe: Graphics;
  /** The goods in the hero's hands. */
  load: Graphics;
  /** What `load` shows, as `resource:amount`, so it's redrawn only when that changes. */
  loadDrawn: string;
}

/** Screen pixels around a walker's drawn shape that still count as clicking it. */
const HIT_PADDING = 10;

/** Whether screen point (sx, sy) is on `node` as last drawn, give or take `HIT_PADDING`. */
function hitsNode(node: Container, sx: number, sy: number): boolean {
  const b = node.getBounds();
  return (
    sx >= b.minX - HIT_PADDING &&
    sx <= b.maxX + HIT_PADDING &&
    sy >= b.minY - HIT_PADDING &&
    sy <= b.maxY + HIT_PADDING
  );
}

/** Pieces drawn in front of a Granary at most, however much it holds. */
const GRANARY_PILE_MAX = 6;

/** What a Granary shows in front: a few pieces of the Food it holds most of, or null if empty. */
function granaryPile(
  content: Content,
  stock: Partial<Record<ResourceId, number>>,
): ResourceAmount | null {
  let best: ResourceAmount | null = null;
  for (const resource of foodIds(content)) {
    const amount = stock[resource] ?? 0;
    if (amount > 0 && (!best || amount > best.amount)) best = { resource, amount };
  }
  return best && { resource: best.resource, amount: Math.min(best.amount, GRANARY_PILE_MAX) };
}

/** What a Workplace shows beside its door: its output of which it holds most (first on ties). */
function outputPile(
  slots: readonly { resource: ResourceId }[] | undefined,
  stock: Partial<Record<ResourceId, number>>,
): ResourceAmount | null {
  let best: ResourceAmount | null = null;
  for (const { resource } of slots ?? []) {
    const amount = stock[resource] ?? 0;
    if (!best || amount > best.amount) best = { resource, amount };
  }
  return best;
}

/** Draws the icon for why a Workplace is idle, centred on (x, y). */
function drawStatusIcon(g: Graphics, status: WorkplaceStatus, x: number, y: number): void {
  if (status.kind === 'noWorker') drawMissingIcon(g, x, y);
  else if (status.resources[0] === undefined) return;
  else if (status.kind === 'waitingFor') drawWaitingIcon(g, x, y, status.resources[0]);
  else drawOutputFullIcon(g, x, y, status.resources[0]);
}

/** A walker's position between its previous and current tick, in grid coordinates. */
function interpolate(from: Point, to: Point, alpha: number): { x: number; y: number } {
  return unitsToGrid({
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  });
}

/** Tool preview: a building footprint, or a set of tiles. */
export type PlacementGhost =
  | {
      kind: 'building';
      type: BuildingId;
      x: number;
      y: number;
      rotation: Rotation;
      valid: boolean;
      /** Tiles in a Den's dark ring, shaded while placing. */
      darkRing: Tile[];
      /** Reserve tiles in its work radius (a woodcutter's hut), picked out while placing. */
      reserve?: Tile[];
    }
  | {
      kind: 'tiles';
      tiles: Tile[];
      valid: boolean;
      /** Tiles in a Den's dark ring, shaded while laying walls. */
      darkRing?: Tile[];
    };

export class WorldRenderer {
  readonly app = new Application();
  /** Its own render group, so panning and zooming move it on the GPU without touching its children. */
  private readonly world = new Container({ isRenderGroup: true });
  private readonly ground = new GroundLayer();
  private readonly roads = new Graphics();
  /** The road heat-map overlay, while it's on. */
  private readonly heat = new Graphics();
  private heatOn = false;
  private heatKey = '';
  private readonly pileGround = new Graphics();
  /** Hunting ground outlines on the ground; their names and health words float above the trees. */
  private readonly grounds = new Graphics();
  private readonly groundLabels = new Container();
  private groundsKey = '';
  /** Each Hunting ground's label tile, by its `tiles` list (the same list until the layer changes). */
  private groundMiddles = new WeakMap<readonly number[], Tile>();
  /** "Fled" puffs over grounds, drawn each frame until they fade. */
  private readonly puffs = new Graphics();
  private readonly puffLabels = new Container();
  private activePuffs: Puff[] = [];
  /** The hero's aura radius (while selected) and the Workplaces it boosts, on the ground. */
  private readonly aura = new Graphics();
  /** Den dark rings on the ground, while a building is being placed. */
  private readonly darkRing = new Graphics();
  private darkRingKey = '';
  /** The Reserve on the ground, redrawn when the layer changes. */
  private readonly reserve = new Graphics();
  private drawnReserve: GameState['map']['reserve'] | null = null;
  /** The Reserve tiles in a woodcutter's hut's radius, picked out while it's being placed. */
  private readonly reservePreview = new Graphics();
  private reservePreviewKey = '';
  /**
   * Everything depth-sorted: trees (a row run each), buildings, villagers. Its own render group, so
   * its re-sorting as walkers move doesn't rebuild the ground's.
   */
  private readonly objects = new Container({ sortableChildren: true, isRenderGroup: true });
  private readonly mapObjects: MapObjectLayer;
  /** The world area on screen (with `VIEW_MARGIN`), as of the last `applyCamera`. */
  private view: Rect = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
  /** Fog over everything on the map but the placement ghost, so the ghost shows over the dark. */
  private readonly fog = new FogLayer();
  private readonly ghost = new Graphics();
  /** Darkness over the whole screen: white, tinted by the night look and multiplied in. */
  private readonly night = new Graphics({ blendMode: 'multiply' });
  private nightSize = '';
  /**
   * Glows of the sim's light sources, added over the darkness so they shine through it. Follows
   * the camera like `world`; faded in and out with the dark.
   */
  private readonly lights = new Graphics({ blendMode: 'add' });
  private lightsKey = '';
  /** Gloamlings' eyes, added over the darkness like `lights` so they shine at night. Per frame. */
  private readonly eyes = new Graphics({ blendMode: 'add' });
  private readonly gloamlings = new Map<EntityId, Container>();
  /** Health bars over everyone in a fight, above the darkness so they read at night. Per frame. */
  private readonly healthBars = new Graphics();
  private bars: HealthBar[] = [];
  private barsState: GameState | null = null;
  private readonly statics = new Map<string, StaticView>();
  private readonly villagers = new Map<EntityId, VillagerView>();
  private hero: HeroView | null = null;
  private heroSelected = false;
  private selectedVillager: EntityId | null = null;
  private lastState: GameState | null = null;
  private drawnRoads: GameState['map']['roads'] | null = null;
  private roadsKey = '';
  private pileGroundKey = '';

  constructor(private readonly content: Content) {
    this.mapObjects = new MapObjectLayer(this.objects, content);
  }

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      background: palette.background,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    });
    parent.appendChild(this.app.canvas);
    this.world.addChild(
      this.ground.node,
      this.roads,
      this.heat,
      this.pileGround,
      this.reserve,
      this.grounds,
      this.aura,
      this.darkRing,
      this.reservePreview,
      this.objects,
      this.groundLabels,
      this.puffs,
      this.puffLabels,
      this.fog.node,
      this.ghost,
    );
    this.app.stage.addChild(this.world, this.night, this.lights, this.eyes, this.healthBars);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get screenWidth(): number {
    return this.app.screen.width;
  }

  get screenHeight(): number {
    return this.app.screen.height;
  }

  applyCamera(camera: CameraView): void {
    const origin = worldOriginOnScreen(camera, this.screenWidth, this.screenHeight);
    this.world.position.set(origin.x, origin.y);
    this.world.scale.set(camera.zoom);
    this.lights.position.set(origin.x, origin.y);
    this.lights.scale.set(camera.zoom);
    this.eyes.position.set(origin.x, origin.y);
    this.eyes.scale.set(camera.zoom);
    this.healthBars.position.set(origin.x, origin.y);
    this.healthBars.scale.set(camera.zoom);
    this.cull(viewRect(camera, this.screenWidth, this.screenHeight));
  }

  /** Hides the ground chunks, tree runs and statics outside `rect` (walkers: `drawWalkers`). */
  private cull(rect: Rect): void {
    const view = {
      minX: rect.minX - VIEW_MARGIN,
      minY: rect.minY - VIEW_MARGIN,
      maxX: rect.maxX + VIEW_MARGIN,
      maxY: rect.maxY + VIEW_MARGIN,
    };
    this.view = view;
    this.ground.cull(view);
    this.mapObjects.cull(view);
    for (const s of this.statics.values()) s.node.visible = s.shown && overlaps(s.bounds, view);
  }

  /**
   * Brings the world in line with a new snapshot. The static layers (ground, Roads, trees and
   * forage patches) are the same objects from snapshot to snapshot until they change, so they're
   * only looked at when they're new, and then only what changed is redrawn.
   */
  syncStatics(state: GameState): void {
    const { map } = state;
    this.ground.sync({
      width: map.width,
      height: map.height,
      terrain: map.terrain,
      frozen: isRiverFrozen(state.tick, this.content),
    });
    this.syncRoads(state);
    this.syncHeat(state);
    this.syncReserve(state);

    this.fog.sync(state);

    const seen = new Set<string>();
    const { tile, mapObject, building, site, den, cache, poi } = state.components;
    this.mapObjects.sync(
      mapObject,
      tile,
      state.fog ? { width: map.width, revealed: map.revealed } : null,
    );
    // Under Fog, nothing on an unrevealed tile is drawn: a thing shows once any of its tiles is
    // Revealed.
    const shown = (x: number, y: number, w: number, h: number) => revealedArea(state, x, y, w, h);

    for (const id of idsOf(den)) {
      const at = tile[id];
      if (!at) continue;
      const view = this.staticView(
        `den:${id}`,
        seen,
        staticBounds(at.x, at.y, 1, 1),
        shown(at.x, at.y, 1, 1),
      );
      const key = `den@${at.x},${at.y}`;
      if (view.key !== key) {
        drawDen(view.graphics);
        view.key = key;
        const c = tileCenterWorld(at.x, at.y);
        view.node.position.set(c.x, c.y);
        view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
      }
    }

    // Points of interest: in front of a map object on the same tile (the mine's iron Deposit, whose
    // row runs sit 1e-6 under the tile's depth), a hair behind a cache (a Searched Ruins').
    for (const id of idsOf(poi)) {
      const at = tile[id];
      const p = poi[id];
      if (!at || !p) continue;
      const view = this.staticView(
        `poi:${id}`,
        seen,
        staticBounds(at.x, at.y, 1, 1),
        shown(at.x, at.y, 1, 1),
      );
      const key = `${p.kind}@${at.x},${at.y}:${p.searched}`;
      if (view.key !== key) {
        if (p.kind === 'ruins') drawRuins(view.graphics, p.searched);
        else if (p.kind === 'shrine') drawShrine(view.graphics);
        else drawAbandonedMine(view.graphics);
        view.key = key;
        const c = tileCenterWorld(at.x, at.y);
        view.node.position.set(c.x, c.y);
        view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5) - 1e-7;
      }
    }

    for (const id of idsOf(cache)) {
      const at = tile[id];
      const stock = cache[id]?.stock;
      if (!at || !stock) continue;
      const goods = (Object.keys(this.content.resources) as ResourceId[]).flatMap((resource) => {
        const amount = stock[resource] ?? 0;
        return amount > 0 ? [{ resource, amount }] : [];
      });
      const view = this.staticView(
        `cache:${id}`,
        seen,
        staticBounds(at.x, at.y, 1, 1),
        shown(at.x, at.y, 1, 1),
      );
      const key = `cache@${at.x},${at.y}:${JSON.stringify(goods)}`;
      if (view.key !== key) {
        drawCache(view.graphics, goods);
        view.key = key;
        const c = tileCenterWorld(at.x, at.y);
        view.node.position.set(c.x, c.y);
        view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
      }
    }

    const walls = builtWallTiles(state, this.content);
    for (const id of idsOf(building)) {
      const b = building[id];
      const at = tile[id];
      if (!b || !at) continue;
      const def = this.content.buildings[b.type];
      if (def.wall) {
        const arms = wallArms(walls, at);
        const broken = isBrokenWall(state, this.content, id);
        const view = this.staticView(
          `building:${id}`,
          seen,
          staticBounds(at.x, at.y, 1, 1),
          shown(at.x, at.y, 1, 1),
        );
        const key = `${b.type}@${at.x},${at.y}:${JSON.stringify(arms)}:${broken}`;
        if (view.key !== key) {
          const layout = buildingLayout(def, at, b.rotation);
          if (broken) drawBrokenWall(view.graphics, layout);
          else if (def.wall.gate) drawGate(view.graphics, layout, arms);
          else drawPalisade(view.graphics, layout, arms);
          view.key = key;
          view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
        }
        continue;
      }
      const layout = buildingLayout(def, at, b.rotation);
      const { size } = layout;
      const buffered = (resource: ResourceId | undefined, amounts: typeof b.stock) =>
        resource ? { resource, amount: amounts[resource] ?? 0 } : null;
      const output =
        def.foodCapacity !== undefined
          ? granaryPile(this.content, b.stock)
          : outputPile(def.outputBuffer, b.stock);
      const input = buffered(def.inputBuffer?.[0]?.resource, b.input);
      const status = workplaceStatus(state, this.content, id);
      const cold = isColdHouse(state, this.content, id) || isDarkLight(state, this.content, id);
      const fuel = def.light ? (b.stock[def.light.fuel] ?? 0) : 0;
      const ringing = def.bell !== undefined && isBellRung(state);
      const view = this.staticView(
        `building:${id}`,
        seen,
        staticBounds(at.x, at.y, size.w, size.h),
        shown(at.x, at.y, size.w, size.h),
      );
      const key = `${b.type}@${at.x},${at.y}r${b.rotation}:${input?.amount}:${output?.resource}${output?.amount}:${JSON.stringify(status)}:${cold}:${fuel}:${ringing}`;
      if (view.key !== key) {
        if (b.type === 'chopping_block') drawChoppingBlock(view.graphics, layout, input, output);
        else if (b.type === 'torch' || b.type === 'brazier') {
          drawLight(view.graphics, layout, b.type, fuel);
        } else if (def.bell) drawBell(view.graphics, layout, ringing);
        else if (def.watch) drawWatchtower(view.graphics, layout);
        else drawBuilding(view.graphics, layout, b.type, output);
        if (status) {
          const c = gridToWorld(at.x + size.w / 2, at.y + size.h / 2);
          drawStatusIcon(view.graphics, status, c.x, c.y - TILE_H * 2.4);
        }
        if (cold) {
          const c = gridToWorld(at.x + size.w / 2, at.y + size.h / 2);
          drawNoFirewoodIcon(view.graphics, c.x, c.y - TILE_H * (def.light ? 1.7 : 2.4));
        }
        view.key = key;
        view.node.zIndex = depthOf(at.x + size.w - 0.5, at.y + size.h - 0.5);
      }
    }

    for (const id of idsOf(site)) {
      const s = site[id];
      const at = tile[id];
      const construction = s ? this.content.buildings[s.type].construction : undefined;
      if (!s || !at || !construction) continue;
      const layout = buildingLayout(this.content.buildings[s.type], at, s.rotation);
      const { size } = layout;
      const needed = construction.cost.reduce((n, c) => n + c.amount, 0);
      const delivered = construction.cost.reduce(
        (n, c) => n + Math.min(c.amount, s.delivered[c.resource] ?? 0),
        0,
      );
      const progress = s.buildProgress / construction.buildTicks;
      const view = this.staticView(
        `site:${id}`,
        seen,
        staticBounds(at.x, at.y, size.w, size.h),
        shown(at.x, at.y, size.w, size.h),
      );
      // Redraw posts in 10% steps; the label updates every change.
      const key = `${s.type}@${at.x},${at.y}r${s.rotation}:${delivered}:${Math.floor(progress * 10)}`;
      const groundwork = this.content.buildings[s.type].groundwork;
      if (groundwork) {
        // Groundwork comes in long lines too: the ditch or the logs show how far along it is.
        if (view.key !== key) {
          const kind = 'road' in groundwork.becomes ? 'passRoad' : 'drain';
          drawGroundworkSite(view.graphics, layout, kind, delivered, progress);
          view.key = key;
          view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
        }
        continue;
      }
      if (this.content.buildings[s.type].wall) {
        // Wall sites come in long lines: no label, the stakes and logs show how far along it is.
        if (view.key !== key) {
          drawWallSite(view.graphics, layout, delivered, progress);
          view.key = key;
          view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
        }
        continue;
      }
      if (view.key !== key) {
        drawSite(view.graphics, layout, delivered, progress);
        view.key = key;
        view.node.zIndex = depthOf(at.x + size.w - 0.5, at.y + size.h - 0.5);
      }
      const label = this.siteLabel(view, size.w, size.h, at.x, at.y);
      label.text =
        delivered < needed
          ? `${delivered}/${needed} logs`
          : `building ${Math.floor(progress * 100)}%`;
    }

    this.syncStockpiles(state, seen);
    this.syncGrounds(state);
    this.syncLights(state);

    for (const [key, view] of this.statics) {
      if (!seen.has(key)) {
        view.node.destroy({ children: true });
        this.statics.delete(key);
      }
    }

    this.lastState = state;
    this.drawAura(state);
  }

  /** Places villagers and the hero between their previous and current positions (`alpha` 0..1). */
  drawWalkers(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    this.drawVillagers(state, prevPositions, alpha, timeMs);
    this.drawHero(state, prevPositions, alpha, timeMs);
    this.drawGloamlings(state, prevPositions, alpha, timeMs);
    this.drawHealthBars(state, prevPositions, alpha);
    this.drawPuffs(timeMs);
  }

  /**
   * A health bar over each villager and Gloamling in a fight, and over each House door or wall
   * segment being battered (the sim's `healthBars`); the Hero's Search progress over its Ruins.
   */
  private drawHealthBars(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
  ): void {
    if (state !== this.barsState) {
      this.bars = healthBars(state, this.content);
      this.barsState = state;
    }
    const g = this.healthBars;
    g.clear();
    const s = TILE_H / 64;
    for (const bar of this.bars) {
      // Under Fog, only over what's In sight.
      if (bar.tile) {
        if (!isInSight(state, bar.tile)) continue;
        // Over a battered door or wall segment, at about the height of its top.
        const c = tileCenterWorld(bar.tile.x, bar.tile.y);
        drawHealthBar(g, c.x, c.y - 60 * s, bar.hp, bar.maxHp);
        continue;
      }
      const to = state.components.position[bar.id];
      if (!to || !seenAt(state, to)) continue;
      const at = interpolate(prevPositions[bar.id] ?? to, to, alpha);
      const w = gridToWorld(at.x, at.y);
      // Over a Gloamling's head, or over a villager's status icons.
      const above = state.components.gloamling[bar.id] ? 36 : 82;
      drawHealthBar(g, w.x, w.y - above * s, bar.hp, bar.maxHp);
    }
    const search = heroSearch(state, this.content);
    if (search) {
      // Above the Hero's head and its health bar.
      const c = tileCenterWorld(search.tile.x, search.tile.y);
      drawProgressBar(g, c.x, c.y - 96 * s, search.percent);
    }
  }

  /**
   * Gloamlings, swaying where they stand and scuttling (a quick hop) as they walk, with their eyes
   * on the `eyes` layer too.
   */
  private drawGloamlings(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const { gloamling, position } = state.components;
    this.eyes.clear();
    const seen = new Set<EntityId>();
    for (const id of idsOf(gloamling)) {
      const to = position[id];
      if (!to) continue;
      seen.add(id);
      let node = this.gloamlings.get(id);
      if (!node) {
        node = new Container();
        const body = new Graphics();
        drawGloamling(body);
        node.addChild(body);
        this.objects.addChild(node);
        this.gloamlings.set(id, node);
      }
      const from = prevPositions[id] ?? to;
      const g = interpolate(from, to, alpha);
      const w = gridToWorld(g.x, g.y);
      // Off-screen, or out of sight under Fog (its eyes too).
      node.visible = overlaps(walkerBounds(w.x, w.y), this.view) && seenAt(state, to);
      if (!node.visible) continue;
      const walking = from.x !== to.x || from.y !== to.y;
      const sway = walking ? 0 : Math.sin(timeMs / 300 + id) * 2 * (TILE_H / 64);
      const hop = walking ? Math.abs(Math.sin(timeMs / 70 + id)) * 4 * (TILE_H / 64) : 0;
      node.position.set(w.x + sway, w.y - hop);
      node.zIndex = depthOf(g.x, g.y) + 0.01;
      drawGloamlingEyes(this.eyes, w.x + sway, w.y - hop);
    }
    for (const [id, node] of this.gloamlings) {
      if (!seen.has(id)) {
        node.destroy({ children: true });
        this.gloamlings.delete(id);
      }
    }
  }

  /** Darkens the screen and fades light sources in by `look` (from `nightLook`). */
  drawNight(look: NightLook): void {
    const size = `${this.screenWidth}x${this.screenHeight}`;
    if (size !== this.nightSize) {
      this.night.clear().rect(0, 0, this.screenWidth, this.screenHeight).fill(0xffffff);
      this.nightSize = size;
    }
    this.night.tint = look.tint;
    this.night.visible = look.tint !== 0xffffff;
    this.lights.alpha = look.glow;
    this.lights.visible = look.glow > 0;
    this.eyes.alpha = look.glow * 0.7;
    this.eyes.visible = look.glow > 0;
  }

  /**
   * Redraws the glows when the sim's light sources change: a lit House's window, or a torch's or
   * brazier's flame and pool of Light.
   */
  private syncLights(state: GameState): void {
    const glows = lightSources(state, this.content).flatMap((light) => {
      const b = state.components.building[light.id];
      const at = state.components.tile[light.id];
      if (!b || !at) return [];
      const layout = buildingLayout(this.content.buildings[b.type], at, b.rotation);
      return [{ light, type: b.type, layout }];
    });
    const key = JSON.stringify(glows);
    if (key === this.lightsKey) return;
    this.lights.clear();
    for (const { light, type, layout } of glows) {
      if (light.kind === 'window') drawWindowLight(this.lights, layout);
      else
        drawLightPool(
          this.lights,
          layout,
          type === 'torch' ? 'torch' : 'brazier',
          light.radiusTiles,
        );
    }
    this.lightsKey = key;
  }

  setHeroSelected(selected: boolean): void {
    this.heroSelected = selected;
    if (this.hero) this.hero.ring.visible = selected;
    if (this.lastState) this.drawAura(this.lastState);
  }

  /** Whether screen point (sx, sy) is on the hero as last drawn. */
  hitHero(sx: number, sy: number): boolean {
    return this.hero !== null && hitsNode(this.hero.node, sx, sy);
  }

  /** The Gloamling drawn at screen point (sx, sy), the frontmost if several overlap. */
  hitGloamling(sx: number, sy: number): EntityId | null {
    let hit: EntityId | null = null;
    let front = -Infinity;
    for (const [id, node] of this.gloamlings) {
      if (node.visible && node.zIndex > front && hitsNode(node, sx, sy)) {
        hit = id;
        front = node.zIndex;
      }
    }
    return hit;
  }

  /** Rings villager `id`, or no villager when null. */
  setSelectedVillager(id: EntityId | null): void {
    this.selectedVillager = id;
    for (const [viewId, view] of this.villagers) view.ring.visible = viewId === id;
  }

  /** The villager drawn at screen point (sx, sy), the frontmost if several overlap. */
  hitVillager(sx: number, sy: number): EntityId | null {
    let hit: EntityId | null = null;
    let front = -Infinity;
    for (const [id, view] of this.villagers) {
      if (view.node.visible && view.node.zIndex > front && hitsNode(view.node, sx, sy)) {
        hit = id;
        front = view.node.zIndex;
      }
    }
    return hit;
  }

  /**
   * Marks every Workplace the sim says is boosted and, while the hero is selected and up, its aura
   * radius. The radius is centred on the hero's tile, as the sim measures it, so it moves a tile
   * at a time.
   */
  private drawAura(state: GameState): void {
    const g = this.aura;
    g.clear();
    const { building, hero, position, tile } = state.components;
    for (const id of boostedWorkplaces(state, this.content)) {
      const b = building[id];
      const at = tile[id];
      if (b && at)
        drawBoostedMark(g, buildingLayout(this.content.buildings[b.type], at, b.rotation));
    }
    const heroId = heroOf(state);
    const h = heroId === null ? undefined : hero[heroId];
    const pos = heroId === null ? undefined : position[heroId];
    if (this.heroSelected && heroId !== null && h && pos && !isKnockedOut(state, heroId)) {
      const at = tileOfPoint(pos);
      drawAuraRadius(g, at.x + 0.5, at.y + 0.5, this.content.heroes[h.type].aura.radiusTiles);
    }
  }

  private drawHero(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const id = heroOf(state);
    const to = id === null ? undefined : state.components.position[id];
    if (id === null || !to) {
      this.hero?.node.destroy({ children: true });
      this.hero = null;
      return;
    }
    const view = this.heroView();
    const from = prevPositions[id] ?? to;
    const g = interpolate(from, to, alpha);
    const w = gridToWorld(g.x, g.y);
    view.node.visible = overlaps(walkerBounds(w.x, w.y), this.view) && seenAt(state, to);
    if (!view.node.visible) return;
    const walking = from.x !== to.x || from.y !== to.y;
    const bob = walking ? Math.abs(Math.sin(timeMs / 90)) * 3 : 0;
    view.node.position.set(w.x, w.y);
    view.body.position.set(0, -bob);
    view.load.position.set(0, -bob);
    view.node.zIndex = depthOf(g.x, g.y) + 0.02;

    const hero = state.components.hero[id];
    const carrying = hero?.carrying ?? null;
    const loadKey = carrying ? `${carrying.resource}:${carrying.amount}` : '';
    if (loadKey !== view.loadDrawn) {
      drawHeroLoad(view.load, carrying);
      view.loadDrawn = loadKey;
    }
    // Chopping: a gather order, standing still next to the tree.
    const chopping = hero?.order?.kind === 'gather' && !state.components.path[id];
    view.axe.visible = chopping;
    if (chopping) view.axe.rotation = -0.4 + Math.abs(Math.sin(timeMs / 160)) * 1.3;
    // Knocked out: lying where it fell, stars circling its head, its load out of sight.
    const out = isKnockedOut(state, id);
    view.body.visible = !out;
    view.load.visible = !out;
    view.fallen.visible = out;
    view.dizzy.visible = out;
    if (out) view.dizzy.rotation = timeMs / 400;
  }

  private drawVillagers(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const { villager, position, woodcutter, crafter, hunter } = state.components;
    const seen = new Set<EntityId>();
    for (const id of idsOf(villager)) {
      const v = villager[id];
      const to = position[id];
      if (!v || !to) continue;
      seen.add(id);
      const view = this.villagerView(id, v.job);
      const from = prevPositions[id] ?? to;
      const g = interpolate(from, to, alpha);
      const w = gridToWorld(g.x, g.y);
      // Off-screen, asleep inside its House (out of sight until it wakes or a Gloamling breaks
      // the door), or out of sight under Fog.
      view.node.visible =
        overlaps(walkerBounds(w.x, w.y), this.view) &&
        !isIndoors(state, this.content, id) &&
        seenAt(state, to);
      if (!view.node.visible) continue;
      const walking = from.x !== to.x || from.y !== to.y;
      const bob = walking ? Math.abs(Math.sin(timeMs / 90)) * 3 : 0;
      view.node.position.set(w.x, w.y - bob);
      view.ring.position.set(0, bob); // stays on the ground while the figure bobs
      view.node.zIndex = depthOf(g.x, g.y) + 0.01;
      // A hunter walking back carries its catch (shown by its first part), or nothing.
      const hunt = hunter[id];
      const bag = hunt?.kind === 'toLodge' ? hunt.bag : null;
      const carried = v.carrying?.resource ?? bag?.[0]?.resource ?? null;
      if (carried && carried !== view.loadDrawn) {
        drawCarriedGoods(view.load, carried);
        view.loadDrawn = carried;
      }
      view.load.visible = carried !== null;
      const homeless = v.home === null;
      const hungry = v.missedMeals > 0;
      const cold = v.coldNights > 0;
      const noCatch = bag !== null && bag.length === 0;
      const status = `${homeless}:${v.tired}:${hungry}:${cold}:${noCatch}`;
      if (status !== view.statusDrawn) {
        drawVillagerStatus(view.status, { homeless, tired: v.tired, hungry, cold, noCatch });
        view.statusDrawn = status;
      }
      // Its goods take the icons' place while it carries something.
      view.status.position.set(0, carried ? -14 * (TILE_H / 64) : 0);
      // Chopping a tree, or working a recipe (only splitting logs so far).
      const swinging = woodcutter[id]?.kind === 'chopping' || crafter[id]?.kind === 'working';
      view.axe.visible = swinging;
      view.tool.visible = !swinging;
      if (swinging) view.axe.rotation = -0.4 + Math.abs(Math.sin(timeMs / 160)) * 1.3;
    }
    for (const [id, view] of this.villagers) {
      if (!seen.has(id)) {
        view.node.destroy({ children: true });
        this.villagers.delete(id);
      }
    }
  }

  setGhost(ghost: PlacementGhost | null): void {
    this.ghost.visible = ghost !== null;
    const ring = ghost?.darkRing ?? [];
    const ringKey = JSON.stringify(ring);
    if (ringKey !== this.darkRingKey) {
      drawDarkRing(this.darkRing, ring);
      this.darkRingKey = ringKey;
    }
    const reserve = ghost?.kind === 'building' ? (ghost.reserve ?? []) : [];
    const reserveKey = JSON.stringify(reserve);
    if (reserveKey !== this.reservePreviewKey) {
      this.reservePreview.clear();
      drawReserve(this.reservePreview, reserve, true);
      this.reservePreviewKey = reserveKey;
    }
    if (ghost?.kind === 'building') {
      const def = this.content.buildings[ghost.type];
      const layout = buildingLayout(def, { x: ghost.x, y: ghost.y }, ghost.rotation);
      drawPlacementGhost(this.ghost, layout, ghost.valid);
    } else if (ghost) {
      drawTileGhost(this.ghost, ghost.tiles, ghost.valid);
    }
  }

  /**
   * Outlines every Hunting ground in its health colour, with its name and health word, and starts
   * a "fled" puff over any ground that lost Game to logging since the last snapshot.
   */
  private syncGrounds(state: GameState): void {
    const { huntingGround } = state.components;
    const ids = idsOf(huntingGround);
    // Under Fog, a ground's name shows once its middle is Revealed; its outline is under the Fog.
    // A ground's tiles never change, so its ID stands for them in the key.
    const named = (g: HuntingGroundComponent) => isRevealed(state, this.middleOf(state, g));
    const key = ids
      .map((id) => {
        const g = huntingGround[id];
        return g ? `${id}:${groundHealth(g, this.content)}:${named(g)}` : '';
      })
      .join('|');
    if (key !== this.groundsKey) {
      this.grounds.clear();
      for (const child of this.groundLabels.removeChildren()) child.destroy();
      for (const id of ids) {
        const g = huntingGround[id];
        if (!g) continue;
        const health = groundHealth(g, this.content);
        drawHuntingGround(this.grounds, groundTiles(state, g), HEALTH_COLORS[health]);
        if (!named(g)) continue;
        const label = this.groundText(`${g.name} · ${HEALTH_WORDS[health]}`, HEALTH_COLORS[health]);
        const middle = this.middleOf(state, g);
        const top = gridToWorld(middle.x + 0.5, middle.y + 0.5);
        label.position.set(top.x, top.y - TILE_H * 1.5);
        this.groundLabels.addChild(label);
      }
      this.groundsKey = key;
    }

    // Only between snapshots of one running game: a new game or a load isn't logging.
    const last = this.lastState;
    const running = last !== null && state.tick > last.tick && state.tick - last.tick <= 60;
    for (const id of running ? ids : []) {
      const g = huntingGround[id];
      const before = last?.components.huntingGround[id];
      if (!g || !before || g.fled <= before.fled) continue;
      const middle = this.middleOf(state, g);
      const c = gridToWorld(middle.x + 0.5, middle.y + 0.5);
      const label = this.groundText(`${g.fled - before.fled} fled`, palette.uiText);
      label.position.set(c.x, c.y - TILE_H * 0.6);
      this.puffLabels.addChild(label);
      this.activePuffs.push({ x: c.x, y: c.y, startMs: null, label });
    }
  }

  /** Hunting ground `g`'s label tile, worked out once per tile list. */
  private middleOf(state: GameState, g: HuntingGroundComponent): Tile {
    let middle = this.groundMiddles.get(g.tiles);
    if (!middle) {
      middle = groundMiddle(state, g);
      this.groundMiddles.set(g.tiles, middle);
    }
    return middle;
  }

  /** Draws the "fled" puffs at `timeMs`, dropping those that have faded. */
  private drawPuffs(timeMs: number): void {
    this.puffs.clear();
    this.activePuffs = this.activePuffs.filter((p) => {
      p.startMs ??= timeMs;
      const t = (timeMs - p.startMs) / PUFF_MS;
      if (t >= 1) {
        p.label.destroy();
        return false;
      }
      drawFledPuff(this.puffs, p.x, p.y, t);
      p.label.alpha = 1 - t;
      p.label.position.set(p.x, p.y - TILE_H * (0.6 + 0.5 * t)); // drifts up as it fades
      return true;
    });
  }

  /** A label over a Hunting ground, anchored at its bottom centre. */
  private groundText(text: string, color: number): Text {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 22,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: palette.ink, width: 5 },
      },
    });
    label.anchor.set(0.5, 1);
    return label;
  }

  /** Shows or hides the road heat-map. */
  setHeatMap(on: boolean): void {
    this.heatOn = on;
    this.heat.visible = on;
    if (this.lastState) this.syncHeat(this.lastState);
  }

  /** Tints each Road tile by its Carrier traffic over the last day, relative to the busiest. */
  private syncHeat(state: GameState): void {
    if (!this.heatOn) return;
    const { map } = state;
    const traffic = roadTraffic(state, this.content);
    const busiest = Math.max(0, ...Object.values(traffic));
    const tiles: HeatTile[] = Object.keys(map.roads).map((k) => {
      const i = Number(k);
      const steps = traffic[i] ?? 0;
      const level = steps === 0 ? 0 : Math.ceil((steps / busiest) * HEAT_LEVELS);
      return { x: i % map.width, y: Math.floor(i / map.width), level };
    });
    const key = JSON.stringify(tiles);
    if (key === this.heatKey) return;
    this.heatKey = key;
    drawHeatMap(this.heat, tiles);
  }

  /** Redraws the Reserve when its layer is a new object and holds other tiles. */
  private syncReserve(state: GameState): void {
    const { map } = state;
    if (map.reserve === this.drawnReserve) return;
    this.drawnReserve = map.reserve;
    const tiles: Tile[] = [];
    map.reserve.forEach((word, w) => {
      if (word === 0) return;
      for (let i = w * 32; i < w * 32 + 32; i++) {
        if (hasTile(map.reserve, i)) tiles.push({ x: i % map.width, y: Math.floor(i / map.width) });
      }
    });
    this.reserve.clear();
    drawReserve(this.reserve, tiles);
  }

  private syncRoads(state: GameState): void {
    const { map } = state;
    if (map.roads === this.drawnRoads) return;
    this.drawnRoads = map.roads;
    const key = `${map.width}:${Object.entries(map.roads).join(',')}`;
    if (key === this.roadsKey) return;
    this.roadsKey = key;
    const has = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < map.width &&
      y < map.height &&
      map.roads[y * map.width + x] !== undefined;
    const tiles: RoadTile[] = Object.entries(map.roads).map(([k, kind]) => {
      const i = Number(k);
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      const open: RoadTile['open'] = [has(x + 1, y), has(x, y + 1), has(x - 1, y), has(x, y - 1)];
      return { x, y, kind, open };
    });
    drawRoads(this.roads, tiles);
  }

  /** Bare dirt under each stockpile, and a stack per tile that grows with its amount. */
  private syncStockpiles(state: GameState, seen: Set<string>): void {
    const { tile, stockpile } = state.components;
    const width = state.map.width;
    const rects: string[] = [];
    for (const id of idsOf(stockpile)) {
      const pile = stockpile[id];
      const at = tile[id];
      if (!pile || !at) continue;
      rects.push(`${at.x},${at.y},${pile.size.w},${pile.size.h}`);
      for (const [k, goods] of Object.entries(pile.goods)) {
        const i = Number(k);
        const x = i % width;
        const y = Math.floor(i / width);
        const view = this.staticView(
          `pileTile:${i}`,
          seen,
          staticBounds(x, y, 1, 1),
          revealedArea(state, x, y, 1, 1),
        );
        const key = `${x},${y}:${goods.resource}:${goods.amount}`;
        if (view.key !== key) {
          drawGoodsStack(view.graphics, goods);
          view.key = key;
          const c = tileCenterWorld(x, y);
          view.node.position.set(c.x, c.y);
          view.node.zIndex = depthOf(x + 0.5, y + 0.5);
        }
      }
    }
    const key = rects.join(';');
    if (key === this.pileGroundKey) return;
    this.pileGroundKey = key;
    this.pileGround.clear();
    for (const r of rects) {
      const [x, y, w, h] = r.split(',').map(Number) as [number, number, number, number];
      drawPileGround(this.pileGround, x, y, w, h);
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  private staticView(key: string, seen: Set<string>, bounds: Rect, shown: boolean): StaticView {
    seen.add(key);
    let view = this.statics.get(key);
    if (!view) {
      const node = new Container();
      const graphics = new Graphics();
      node.addChild(graphics);
      this.objects.addChild(node);
      view = { node, graphics, key: '', bounds, shown };
      this.statics.set(key, view);
    }
    view.bounds = bounds;
    view.shown = shown;
    view.node.visible = shown && overlaps(bounds, this.view);
    return view;
  }

  private siteLabel(view: StaticView, w: number, h: number, ox: number, oy: number): Text {
    if (!view.label) {
      view.label = new Text({
        text: '',
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 20,
          fontWeight: 'bold',
          fill: palette.uiText,
          stroke: { color: palette.ink, width: 5 },
        },
      });
      view.label.anchor.set(0.5, 1);
      view.node.addChild(view.label);
    }
    const c = gridToWorld(ox + w / 2, oy + h / 2);
    view.label.position.set(c.x, c.y - TILE_H);
    return view.label;
  }

  private heroView(): HeroView {
    if (!this.hero) {
      const node = new Container();
      const ring = new Graphics();
      drawSelectionRing(ring);
      ring.visible = this.heroSelected;
      const body = new Graphics();
      drawHero(body);
      const fallen = new Graphics();
      drawHeroFallen(fallen);
      fallen.visible = false;
      const dizzy = new Graphics();
      drawDizzyStars(dizzy);
      dizzy.position.set(-22 * (TILE_H / 64), -24 * (TILE_H / 64));
      dizzy.visible = false;
      const axe = new Graphics();
      drawAxe(axe);
      axe.position.set(11, -22);
      axe.visible = false;
      const load = new Graphics();
      node.addChild(ring, body, fallen, dizzy, axe, load);
      this.objects.addChild(node);
      this.hero = { node, body, fallen, dizzy, ring, axe, load, loadDrawn: '' };
    }
    return this.hero;
  }

  private villagerView(id: EntityId, job: JobId): VillagerView {
    let view = this.villagers.get(id);
    if (!view) {
      const node = new Container();
      const ring = new Graphics();
      drawSelectionRing(ring);
      ring.visible = id === this.selectedVillager;
      const body = new Graphics();
      drawVillager(body, job);
      const tool = new Graphics();
      drawVillagerTool(tool, job);
      const axe = new Graphics();
      drawAxe(axe);
      axe.position.set(9, -18);
      axe.visible = false;
      const load = new Graphics();
      load.visible = false;
      const status = new Graphics();
      node.addChild(ring, body, tool, axe, load, status);
      this.objects.addChild(node);
      view = {
        node,
        ring,
        body,
        bodyJob: job,
        tool,
        load,
        loadDrawn: null,
        axe,
        status,
        statusDrawn: '',
      };
      this.villagers.set(id, view);
    }
    if (view.bodyJob !== job) {
      drawVillager(view.body, job);
      drawVillagerTool(view.tool, job);
      view.bodyJob = job;
    }
    return view;
  }
}

/** Whether any of the `w`×`h` tiles from (x, y) is Revealed (all are, with Fog off). */
function revealedArea(state: GameState, x: number, y: number, w: number, h: number): boolean {
  if (!state.fog) return true;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) if (isRevealed(state, { x: x + i, y: y + j })) return true;
  }
  return false;
}

/** Whether a walker at sim position `p` is In sight: under Fog, only those are drawn. */
function seenAt(state: GameState, p: Point): boolean {
  return isInSight(state, tileOfPoint(p));
}

/** Tile keys ("x,y") of every built wall segment (palisade or Gate) still standing. */
function builtWallTiles(state: GameState, content: Content): Set<string> {
  const { building, tile } = state.components;
  const tiles = new Set<string>();
  for (const id of idsOf(building)) {
    const b = building[id];
    const at = tile[id];
    if (b && at && content.buildings[b.type].wall && !isBrokenWall(state, content, id)) {
      tiles.add(`${at.x},${at.y}`);
    }
  }
  return tiles;
}

/** Which sides of the wall segment at `at` join another built one. */
function wallArms(walls: Set<string>, at: Tile): WallArms {
  return {
    north: walls.has(`${at.x},${at.y - 1}`),
    east: walls.has(`${at.x + 1},${at.y}`),
    south: walls.has(`${at.x},${at.y + 1}`),
    west: walls.has(`${at.x - 1},${at.y}`),
  };
}
