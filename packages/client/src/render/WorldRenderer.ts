// Draws sim snapshots with PixiJS. Reads state only; all game rules stay in the sim.
import type { BuildingId, Content } from '@candlemarch/content';
import { type EntityId, type GameState, idsOf, type Point } from '@candlemarch/sim';
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
  drawAxe,
  drawBuilding,
  drawCarriedLog,
  drawGround,
  drawPlacementGhost,
  drawSite,
  drawTree,
  drawVillager,
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

export interface PlacementGhost {
  type: BuildingId;
  x: number;
  y: number;
  valid: boolean;
}

export class WorldRenderer {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly ground = new Graphics();
  private readonly objects = new Container({ sortableChildren: true });
  private readonly ghost = new Graphics();
  private readonly statics = new Map<string, StaticView>();
  private readonly villagers = new Map<EntityId, VillagerView>();
  private groundKey = '';

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
    this.world.addChild(this.ground, this.objects, this.ghost);
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

    const seen = new Set<string>();
    const { tile, mapObject, building, site } = state.components;

    for (const id of idsOf(mapObject)) {
      const obj = mapObject[id];
      const at = tile[id];
      if (!obj || !at) continue;
      const full = this.content.mapObjects[obj.type].amount;
      const view = this.staticView(`tree:${id}`, seen);
      if (view.key !== `${obj.amount}`) {
        drawTree(view.graphics, obj.amount, full);
        view.key = `${obj.amount}`;
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
      const view = this.staticView(`building:${id}`, seen);
      const key = `${b.type}:${stock}`;
      if (view.key !== key) {
        drawBuilding(view.graphics, def, at.x, at.y, stock);
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
      const key = `${delivered}:${Math.floor(progress * 10)}`;
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

    for (const [key, view] of this.statics) {
      if (!seen.has(key)) {
        view.node.destroy({ children: true });
        this.statics.delete(key);
      }
    }
  }

  /** Places villagers between their previous and current positions (`alpha` 0..1). */
  drawVillagers(
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
      const view = this.villagerView(id, v.role === 'woodcutter');
      const from = prevPositions[id] ?? to;
      const g = unitsToGrid({
        x: from.x + (to.x - from.x) * alpha,
        y: from.y + (to.y - from.y) * alpha,
      });
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
    if (ghost) {
      drawPlacementGhost(
        this.ghost,
        this.content.buildings[ghost.type],
        ghost.x,
        ghost.y,
        ghost.valid,
      );
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
      const c = gridToWorld(ox + w / 2, oy + h / 2);
      view.label.position.set(c.x, c.y - TILE_H);
      view.node.addChild(view.label);
    }
    return view.label;
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
