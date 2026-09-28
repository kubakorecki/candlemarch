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
  heroOf,
  idsOf,
  isColdHouse,
  isRiverFrozen,
  isWithered,
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
import {
  type CameraView,
  depthOf,
  gridToWorld,
  TILE_H,
  tileCenterWorld,
  unitsToGrid,
  worldOriginOnScreen,
} from './iso';
import type { NightLook } from './night';
import { palette } from './palette';
import {
  drawAuraRadius,
  drawAxe,
  drawBerryBush,
  drawBoostedMark,
  drawBuilding,
  drawCarriedGoods,
  drawChoppingBlock,
  drawFledPuff,
  drawGoodsStack,
  drawGround,
  drawHeatMap,
  drawHero,
  drawHeroLoad,
  drawHuntingGround,
  drawMissingIcon,
  drawMushroomPatch,
  drawNoFirewoodIcon,
  drawOutputFullIcon,
  drawPileGround,
  drawPlacementGhost,
  drawRoads,
  drawSelectionRing,
  drawSite,
  drawTileGhost,
  drawTree,
  drawVillager,
  drawVillagerStatus,
  drawWaitingIcon,
  drawWindowLight,
  HEAT_LEVELS,
  type HeatTile,
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
  hunter: palette.hunter,
};

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
    }
  | { kind: 'tiles'; tiles: Tile[]; valid: boolean };

export class WorldRenderer {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly ground = new Graphics();
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
  /** "Fled" puffs over grounds, drawn each frame until they fade. */
  private readonly puffs = new Graphics();
  private readonly puffLabels = new Container();
  private activePuffs: Puff[] = [];
  /** The hero's aura radius (while selected) and the Workplaces it boosts, on the ground. */
  private readonly aura = new Graphics();
  private readonly objects = new Container({ sortableChildren: true });
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
      this.heat,
      this.pileGround,
      this.grounds,
      this.aura,
      this.objects,
      this.groundLabels,
      this.puffs,
      this.puffLabels,
      this.ghost,
    );
    this.app.stage.addChild(this.world, this.night, this.lights);
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
    this.syncHeat(state);

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
      const cold = isColdHouse(state, this.content, id);
      const view = this.staticView(`building:${id}`, seen);
      const key = `${b.type}@${at.x},${at.y}r${b.rotation}:${input?.amount}:${output?.resource}${output?.amount}:${JSON.stringify(status)}:${cold}`;
      if (view.key !== key) {
        if (b.type === 'chopping_block') drawChoppingBlock(view.graphics, layout, input, output);
        else drawBuilding(view.graphics, layout, output, def.residents !== undefined);
        if (status) {
          const c = gridToWorld(at.x + size.w / 2, at.y + size.h / 2);
          drawStatusIcon(view.graphics, status, c.x, c.y - TILE_H * 2.4);
        }
        if (cold) {
          const c = gridToWorld(at.x + size.w / 2, at.y + size.h / 2);
          drawNoFirewoodIcon(view.graphics, c.x, c.y - TILE_H * 2.4);
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
      const view = this.staticView(`site:${id}`, seen);
      // Redraw posts in 10% steps; the label updates every change.
      const key = `${s.type}@${at.x},${at.y}r${s.rotation}:${delivered}:${Math.floor(progress * 10)}`;
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
    this.drawPuffs(timeMs);
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
  }

  /** Redraws the glows when the sim's light sources change. */
  private syncLights(state: GameState): void {
    const sources = lightSources(state, this.content);
    const layouts = sources.flatMap((light) => {
      const b = state.components.building[light.id];
      const at = state.components.tile[light.id];
      return b && at ? [buildingLayout(this.content.buildings[b.type], at, b.rotation)] : [];
    });
    const key = JSON.stringify(layouts);
    if (key === this.lightsKey) return;
    this.lights.clear();
    for (const layout of layouts) drawWindowLight(this.lights, layout);
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
      if (b && at)
        drawBoostedMark(g, buildingLayout(this.content.buildings[b.type], at, b.rotation));
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
    const key = ids
      .map((id) => {
        const g = huntingGround[id];
        return g ? `${id}:${g.x},${g.y},${g.w},${g.h}:${groundHealth(g, this.content)}` : '';
      })
      .join('|');
    if (key !== this.groundsKey) {
      this.grounds.clear();
      for (const child of this.groundLabels.removeChildren()) child.destroy();
      for (const id of ids) {
        const g = huntingGround[id];
        if (!g) continue;
        const health = groundHealth(g, this.content);
        drawHuntingGround(this.grounds, g.x, g.y, g.w, g.h, HEALTH_COLORS[health]);
        const label = this.groundText(`${g.name} · ${HEALTH_WORDS[health]}`, HEALTH_COLORS[health]);
        const top = gridToWorld(g.x + g.w / 2, g.y + g.h / 2);
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
      const c = gridToWorld(g.x + g.w / 2, g.y + g.h / 2);
      const label = this.groundText(`${g.fled - before.fled} fled`, palette.hudText);
      label.position.set(c.x, c.y - TILE_H * 0.6);
      this.puffLabels.addChild(label);
      this.activePuffs.push({ x: c.x, y: c.y, startMs: null, label });
    }
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
