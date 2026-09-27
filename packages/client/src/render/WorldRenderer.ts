// Draws sim snapshots with PixiJS. Reads state only; all game rules stay in the sim.
import type { BuildingId, Content, JobId, ResourceAmount, ResourceId } from '@candlemarch/content';
import {
  boostedWorkplaces,
  type EntityId,
  foodIds,
  type GameState,
  heroOf,
  idsOf,
  isRiverFrozen,
  isWithered,
  openPositions,
  type Point,
  type Tile,
  tileOfPoint,
} from '@candlemarch/sim';
import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  type CameraView,
  depthOf,
  gridToWorld,
  TILE_H,
  tileCenterWorld,
  unitsToGrid,
  worldOriginOnScreen,
} from './iso';
import { palette } from './palette';
import {
  drawAuraRadius,
  drawAxe,
  drawBerryBush,
  drawBoostedMark,
  drawBuilding,
  drawCarriedGoods,
  drawChoppingBlock,
  drawGoodsStack,
  drawGround,
  drawHero,
  drawHeroLoad,
  drawMissingIcon,
  drawMushroomPatch,
  drawPileGround,
  drawPlacementGhost,
  drawRoads,
  drawSelectionRing,
  drawSite,
  drawTileGhost,
  drawTree,
  drawVillager,
  drawVillagerStatus,
  type RoadTile,
} from './shapes';

/** A tree, building or construction site, redrawn only when what it shows changes. */
interface StaticView {
  node: Container;
  graphics: Graphics;
  label?: Text;
  /** Summary of the drawn data; a different key means redraw. */
  key: string;
}

/** Body colour per Job. */
const JOB_COLORS: Record<JobId, number> = {
  carrier: palette.carrier,
  woodcutter: palette.woodcutter,
  woodsplitter: palette.woodsplitter,
  fisher: palette.fisher,
  forager: palette.forager,
};

interface VillagerView {
  node: Container;
  /** Selection ring on the ground under the feet. */
  ring: Graphics;
  body: Graphics;
  /** The Job `body` is coloured for, so it's redrawn when a Carrier is drafted. */
  bodyJob: JobId;
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
  /** Swings while the hero chops. */
  axe: Graphics;
  /** The goods in the hero's hands. */
  load: Graphics;
  /** What `load` shows, as `resource:amount`, so it's redrawn only when that changes. */
  loadDrawn: string;
}

/** Opacity of the night tint at full dark. */
const NIGHT_ALPHA = 0.5;

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

/** A walker's position between its previous and current tick, in grid coordinates. */
function interpolate(from: Point, to: Point, alpha: number): { x: number; y: number } {
  return unitsToGrid({
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  });
}

/** Tool preview: a building footprint, or a set of tiles. */
export type PlacementGhost =
  | { kind: 'building'; type: BuildingId; x: number; y: number; valid: boolean }
  | { kind: 'tiles'; tiles: Tile[]; valid: boolean };

export class WorldRenderer {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly ground = new Graphics();
  private readonly roads = new Graphics();
  private readonly pileGround = new Graphics();
  /** The hero's aura radius (while selected) and the Workplaces it boosts, on the ground. */
  private readonly aura = new Graphics();
  private readonly objects = new Container({ sortableChildren: true });
  private readonly ghost = new Graphics();
  /** Darkness over the whole screen at night. */
  private readonly night = new Graphics();
  private nightSize = '';
  private readonly statics = new Map<string, StaticView>();
  private readonly villagers = new Map<EntityId, VillagerView>();
  private hero: HeroView | null = null;
  private heroSelected = false;
  private selectedVillager: EntityId | null = null;
  private lastState: GameState | null = null;
  private groundKey = '';
  private roadsKey = '';
  private pileGroundKey = '';

  constructor(private readonly content: Content) {}

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
      this.ground,
      this.roads,
      this.pileGround,
      this.aura,
      this.objects,
      this.ghost,
    );
    this.app.stage.addChild(this.world, this.night);
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
  }

  /** Brings trees, buildings and sites in line with a new snapshot. */
  syncStatics(state: GameState): void {
    const { map } = state;
    // Terrain is in the key: a new game or a load can bring a same-sized map with other terrain.
    const frozen = isRiverFrozen(state.tick, this.content);
    const groundKey = `${map.width}x${map.height}:${frozen}:${map.terrain.join()}`;
    if (groundKey !== this.groundKey) {
      drawGround(this.ground, map.width, map.height, map.terrain, frozen);
      this.groundKey = groundKey;
    }

    this.syncRoads(state);

    const seen = new Set<string>();
    const { tile, mapObject, building, site } = state.components;

    for (const id of idsOf(mapObject)) {
      const obj = mapObject[id];
      const at = tile[id];
      if (!obj || !at) continue;
      const full = this.content.mapObjects[obj.type].amount;
      const withered = isWithered(state, this.content, id);
      const view = this.staticView(`tree:${id}`, seen);
      const key = `${obj.type}@${at.x},${at.y}:${obj.amount}:${withered}`;
      if (view.key !== key) {
        if (obj.type === 'berry_bush') drawBerryBush(view.graphics, obj.amount, withered);
        else if (obj.type === 'mushroom_patch') {
          drawMushroomPatch(view.graphics, obj.amount, withered);
        } else drawTree(view.graphics, obj.amount, full);
        view.key = key;
        const c = tileCenterWorld(at.x, at.y);
        view.node.position.set(c.x, c.y);
        view.node.zIndex = depthOf(at.x + 0.5, at.y + 0.5);
      }
    }

    for (const id of idsOf(building)) {
      const b = building[id];
      const at = tile[id];
      if (!b || !at) continue;
      const def = this.content.buildings[b.type];
      const buffered = (resource: ResourceId | undefined, amounts: typeof b.stock) =>
        resource ? { resource, amount: amounts[resource] ?? 0 } : null;
      const output =
        def.foodCapacity !== undefined
          ? granaryPile(this.content, b.stock)
          : outputPile(def.outputBuffer, b.stock);
      const input = buffered(def.inputBuffer?.[0]?.resource, b.input);
      const unstaffed = openPositions(state, this.content, id).length > 0;
      const view = this.staticView(`building:${id}`, seen);
      const key = `${b.type}@${at.x},${at.y}:${input?.amount}:${output?.resource}${output?.amount}:${unstaffed}`;
      if (view.key !== key) {
        if (b.type === 'chopping_block')
          drawChoppingBlock(view.graphics, at.x, at.y, input, output);
        else drawBuilding(view.graphics, def, at.x, at.y, output);
        if (unstaffed) {
          const c = gridToWorld(at.x + def.size.w / 2, at.y + def.size.h / 2);
          drawMissingIcon(view.graphics, c.x, c.y - TILE_H * 2.4);
        }
        view.key = key;
        view.node.zIndex = depthOf(at.x + def.size.w - 0.5, at.y + def.size.h - 0.5);
      }
    }

    for (const id of idsOf(site)) {
      const s = site[id];
      const at = tile[id];
      const construction = s ? this.content.buildings[s.type].construction : undefined;
      if (!s || !at || !construction) continue;
      const def = this.content.buildings[s.type];
      const needed = construction.cost.reduce((n, c) => n + c.amount, 0);
      const delivered = construction.cost.reduce(
        (n, c) => n + Math.min(c.amount, s.delivered[c.resource] ?? 0),
        0,
      );
      const progress = s.buildProgress / construction.buildTicks;
      const view = this.staticView(`site:${id}`, seen);
      // Redraw posts in 10% steps; the label updates every change.
      const key = `${s.type}@${at.x},${at.y}:${delivered}:${Math.floor(progress * 10)}`;
      if (view.key !== key) {
        drawSite(view.graphics, def, at.x, at.y, delivered, progress);
        view.key = key;
        view.node.zIndex = depthOf(at.x + def.size.w - 0.5, at.y + def.size.h - 0.5);
      }
      const label = this.siteLabel(view, def.size.w, def.size.h, at.x, at.y);
      label.text =
        delivered < needed
          ? `${delivered}/${needed} logs`
          : `building ${Math.floor(progress * 100)}%`;
    }

    this.syncStockpiles(state, seen);

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
  }

  /** Tints the screen for night: `darkness` 0 is day, 1 full night. */
  drawNight(darkness: number): void {
    const size = `${this.screenWidth}x${this.screenHeight}`;
    if (size !== this.nightSize) {
      this.night.clear().rect(0, 0, this.screenWidth, this.screenHeight).fill(palette.night);
      this.nightSize = size;
    }
    this.night.alpha = darkness * NIGHT_ALPHA;
    this.night.visible = darkness > 0;
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
      if (view.node.zIndex > front && hitsNode(view.node, sx, sy)) {
        hit = id;
        front = view.node.zIndex;
      }
    }
    return hit;
  }

  /**
   * Marks every Workplace the sim says is boosted and, while the hero is selected, its aura
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
      if (b && at) drawBoostedMark(g, this.content.buildings[b.type], at.x, at.y);
    }
    const heroId = heroOf(state);
    const h = heroId === null ? undefined : hero[heroId];
    const pos = heroId === null ? undefined : position[heroId];
    if (this.heroSelected && h && pos) {
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
  }

  private drawVillagers(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const { villager, position, woodcutter, crafter } = state.components;
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
      const walking = from.x !== to.x || from.y !== to.y;
      const bob = walking ? Math.abs(Math.sin(timeMs / 90)) * 3 : 0;
      view.node.position.set(w.x, w.y - bob);
      view.ring.position.set(0, bob); // stays on the ground while the figure bobs
      view.node.zIndex = depthOf(g.x, g.y) + 0.01;
      const carried = v.carrying?.resource ?? null;
      if (carried && carried !== view.loadDrawn) {
        drawCarriedGoods(view.load, carried);
        view.loadDrawn = carried;
      }
      view.load.visible = carried !== null;
      const homeless = v.home === null;
      const hungry = v.missedMeals > 0;
      const status = `${homeless}:${v.tired}:${hungry}`;
      if (status !== view.statusDrawn) {
        drawVillagerStatus(view.status, homeless, v.tired, hungry);
        view.statusDrawn = status;
      }
      // Its goods take the icons' place while it carries something.
      view.status.position.set(0, carried ? -14 * (TILE_H / 64) : 0);
      // Chopping a tree, or working a recipe (only splitting logs so far).
      const swinging = woodcutter[id]?.kind === 'chopping' || crafter[id]?.kind === 'working';
      view.axe.visible = swinging;
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
    if (ghost?.kind === 'building') {
      drawPlacementGhost(
        this.ghost,
        this.content.buildings[ghost.type],
        ghost.x,
        ghost.y,
        ghost.valid,
      );
    } else if (ghost) {
      drawTileGhost(this.ghost, ghost.tiles, ghost.valid);
    }
  }

  private syncRoads(state: GameState): void {
    const { map } = state;
    const key = Object.keys(map.roads).join(',');
    if (key === this.roadsKey) return;
    this.roadsKey = key;
    const has = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < map.width &&
      y < map.height &&
      map.roads[y * map.width + x] !== undefined;
    const tiles: RoadTile[] = Object.keys(map.roads).map((k) => {
      const i = Number(k);
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      return { x, y, open: [has(x + 1, y), has(x, y + 1), has(x - 1, y), has(x, y - 1)] };
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
        const view = this.staticView(`pileTile:${i}`, seen);
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

  private staticView(key: string, seen: Set<string>): StaticView {
    seen.add(key);
    let view = this.statics.get(key);
    if (!view) {
      const node = new Container();
      const graphics = new Graphics();
      node.addChild(graphics);
      this.objects.addChild(node);
      view = { node, graphics, key: '' };
      this.statics.set(key, view);
    }
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
          fill: palette.hudText,
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
      const axe = new Graphics();
      drawAxe(axe);
      axe.position.set(11, -22);
      axe.visible = false;
      const load = new Graphics();
      node.addChild(ring, body, axe, load);
      this.objects.addChild(node);
      this.hero = { node, body, ring, axe, load, loadDrawn: '' };
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
      drawVillager(body, JOB_COLORS[job]);
      const axe = new Graphics();
      drawAxe(axe);
      axe.position.set(9, -18);
      axe.visible = false;
      const load = new Graphics();
      load.visible = false;
      const status = new Graphics();
      node.addChild(ring, body, axe, load, status);
      this.objects.addChild(node);
      view = {
        node,
        ring,
        body,
        bodyJob: job,
        load,
        loadDrawn: null,
        axe,
        status,
        statusDrawn: '',
      };
      this.villagers.set(id, view);
    }
    if (view.bodyJob !== job) {
      drawVillager(view.body, JOB_COLORS[job]);
      view.bodyJob = job;
    }
    return view;
  }
}
