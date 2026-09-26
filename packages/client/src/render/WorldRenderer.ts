// Draws sim snapshots with PixiJS. Reads state only; all game rules stay in the sim.
import type { BuildingId, Content } from '@candlemarch/content';
import {
  boostedWorkplaces,
  type EntityId,
  type GameState,
  idsOf,
  openPositions,
  type Point,
  TILE_UNITS,
  type Tile,
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
  drawBoostedMark,
  drawBuilding,
  drawCarriedLog,
  drawGoodsStack,
  drawGround,
  drawHero,
  drawMissingIcon,
  drawPileGround,
  drawPlacementGhost,
  drawRoads,
  drawSelectionRing,
  drawSite,
  drawTileGhost,
  drawTree,
  drawVillager,
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

interface VillagerView {
  node: Container;
  log: Graphics;
  axe: Graphics;
}

interface HeroView {
  node: Container;
  /** The figure; bobs while walking. */
  body: Graphics;
  /** Selection ring on the ground under the feet. */
  ring: Graphics;
}

/** Screen pixels around the hero's drawn shape that still count as clicking it. */
const HERO_HIT_PADDING = 10;

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
  private readonly statics = new Map<string, StaticView>();
  private readonly villagers = new Map<EntityId, VillagerView>();
  private hero: HeroView | null = null;
  private heroSelected = false;
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
    this.app.stage.addChild(this.world);
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
    const groundKey = `${map.width}x${map.height}`;
    if (groundKey !== this.groundKey) {
      drawGround(this.ground, map.width, map.height);
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
      const view = this.staticView(`tree:${id}`, seen);
      const key = `${at.x},${at.y}:${obj.amount}`;
      if (view.key !== key) {
        drawTree(view.graphics, obj.amount, full);
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
      const stock = def.outputBuffer ? (b.stock[def.outputBuffer.resource] ?? 0) : 0;
      const unstaffed = openPositions(state, this.content, id).length > 0;
      const view = this.staticView(`building:${id}`, seen);
      const key = `${b.type}@${at.x},${at.y}:${stock}:${unstaffed}`;
      if (view.key !== key) {
        drawBuilding(view.graphics, def, at.x, at.y, stock);
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

  setHeroSelected(selected: boolean): void {
    this.heroSelected = selected;
    if (this.hero) this.hero.ring.visible = selected;
    if (this.lastState) this.drawAura(this.lastState);
  }

  /** Whether screen point (sx, sy) is on the hero as last drawn. */
  hitHero(sx: number, sy: number): boolean {
    if (!this.hero) return false;
    const b = this.hero.node.getBounds();
    return (
      sx >= b.minX - HERO_HIT_PADDING &&
      sx <= b.maxX + HERO_HIT_PADDING &&
      sy >= b.minY - HERO_HIT_PADDING &&
      sy <= b.maxY + HERO_HIT_PADDING
    );
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
    const heroId = idsOf(hero)[0];
    const h = heroId === undefined ? undefined : hero[heroId];
    const pos = heroId === undefined ? undefined : position[heroId];
    if (this.heroSelected && h && pos) {
      const tx = Math.floor(pos.x / TILE_UNITS);
      const ty = Math.floor(pos.y / TILE_UNITS);
      drawAuraRadius(g, tx + 0.5, ty + 0.5, this.content.heroes[h.type].aura.radiusTiles);
    }
  }

  private drawHero(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const { hero, position } = state.components;
    const id = idsOf(hero)[0];
    const to = id === undefined ? undefined : position[id];
    if (id === undefined || !to) {
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
    view.node.zIndex = depthOf(g.x, g.y) + 0.02;
  }

  private drawVillagers(
    state: GameState,
    prevPositions: Record<EntityId, Point>,
    alpha: number,
    timeMs: number,
  ): void {
    const { villager, position, woodcutter } = state.components;
    const seen = new Set<EntityId>();
    for (const id of idsOf(villager)) {
      const v = villager[id];
      const to = position[id];
      if (!v || !to) continue;
      seen.add(id);
      const view = this.villagerView(id, v.job === 'woodcutter');
      const from = prevPositions[id] ?? to;
      const g = interpolate(from, to, alpha);
      const w = gridToWorld(g.x, g.y);
      const walking = from.x !== to.x || from.y !== to.y;
      const bob = walking ? Math.abs(Math.sin(timeMs / 90)) * 3 : 0;
      view.node.position.set(w.x, w.y - bob);
      view.node.zIndex = depthOf(g.x, g.y) + 0.01;
      view.log.visible = v.carrying !== null;
      const chopping = woodcutter[id]?.kind === 'chopping';
      view.axe.visible = chopping;
      if (chopping) view.axe.rotation = -0.4 + Math.abs(Math.sin(timeMs / 160)) * 1.3;
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
          drawGoodsStack(view.graphics, goods.amount);
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
      node.addChild(ring, body);
      this.objects.addChild(node);
      this.hero = { node, body, ring };
    }
    return this.hero;
  }

  private villagerView(id: EntityId, woodcutter: boolean): VillagerView {
    let view = this.villagers.get(id);
    if (!view) {
      const node = new Container();
      const body = new Graphics();
      drawVillager(body, woodcutter ? palette.woodcutter : palette.carrier);
      const axe = new Graphics();
      drawAxe(axe);
      axe.position.set(9, -18);
      axe.visible = false;
      const log = new Graphics();
      drawCarriedLog(log);
      log.visible = false;
      node.addChild(body, axe, log);
      this.objects.addChild(node);
      view = { node, log, axe };
      this.villagers.set(id, view);
    }
    return view;
  }
}
