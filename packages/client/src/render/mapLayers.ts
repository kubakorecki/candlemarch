// The map's static layers on screen: the ground, drawn in chunks, and the trees and forage patches,
// drawn a row run at a time (`mapObjectRuns.ts`). Each redraws only what changed and hides what's
// off-screen (`cull`). ADR-0004.
import type { Content, TerrainId } from '@candlemarch/content';
import type { MapObjectComponent, Store, Tile } from '@candlemarch/sim';
import { Container, Graphics } from 'pixi.js';
import { overlaps, type Rect, TILE_H, tileAreaBounds, tileCenterWorld } from './iso';
import { MapObjectRuns } from './mapObjectRuns';
import {
  drawBerryBush,
  drawGrass,
  drawGridLines,
  drawGroundEdge,
  drawMapOutline,
  drawMushroomPatch,
  drawShore,
  drawTree,
  drawWater,
  type GroundMap,
  type TileChunk,
} from './shapes';

/** Tiles a side of one ground chunk. */
const GROUND_CHUNK_TILES = 16;

/** How far a map object's art reaches over its tile's top corner (the tallest tree, and some). */
const MAP_OBJECT_ABOVE = TILE_H * 1.6;

/**
 * A row run's draw depth under its tiles' own (x + y + 1, the depth of their centres), by a hair:
 * on a tie with a building or pile at the same depth, the run is drawn first, as trees made before
 * the building always were.
 */
const RUN_DEPTH_NUDGE = 1e-6;

function sameTerrain(a: readonly TerrainId[], b: readonly TerrainId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A `Graphics` whose GPU data Pixi keeps while it's culled. Pixi otherwise frees what hasn't been
 * drawn for a minute, and rebuilding it when the camera comes back makes a frame hitch.
 */
function keptGraphics(): Graphics {
  const g = new Graphics();
  g.autoGarbageCollect = false;
  g.context.autoGarbageCollect = false;
  return g;
}

interface GroundChunk {
  tiles: TileChunk;
  bounds: Rect;
  grass: Graphics;
  grid: Graphics;
  water: Graphics;
  shore: Graphics;
}

/** The ground, under everything: its own render group, as it changes seldom. */
export class GroundLayer {
  readonly node = new Container({ isRenderGroup: true });
  private readonly edge = new Graphics();
  private readonly grass = new Container();
  private readonly grid = new Container();
  private readonly water = new Container();
  private readonly shore = new Container();
  private readonly outline = new Graphics();
  private chunks: GroundChunk[] = [];
  private drawn: GroundMap | null = null;
  /**
   * Set when chunks were (re)drawn: the next frame draws all of them, culled or not, so Pixi builds
   * their GPU data up front rather than in the middle of a pan.
   */
  private warmUp = false;

  constructor() {
    this.node.addChild(this.edge, this.grass, this.grid, this.water, this.shore, this.outline);
  }

  /** Redraws what differs from the map last drawn: all of it, or only the water on a freeze or thaw. */
  sync(map: GroundMap): void {
    const was = this.drawn;
    if (was && was.terrain === map.terrain && was.frozen === map.frozen) return;
    const sameLand =
      was !== null &&
      was.width === map.width &&
      was.height === map.height &&
      sameTerrain(was.terrain, map.terrain);
    this.drawn = { ...map };
    if (sameLand && was.frozen === map.frozen) return;
    this.warmUp = true;
    if (sameLand) {
      for (const chunk of this.chunks) drawWater(chunk.water, chunk.tiles, map);
      return;
    }
    this.rebuild(map);
  }

  cull(view: Rect): void {
    const all = this.warmUp;
    this.warmUp = false;
    for (const chunk of this.chunks) {
      const visible = all || overlaps(chunk.bounds, view);
      chunk.grass.visible = visible;
      chunk.grid.visible = visible;
      chunk.water.visible = visible;
      chunk.shore.visible = visible;
    }
  }

  private rebuild(map: GroundMap): void {
    for (const layer of [this.grass, this.grid, this.water, this.shore]) {
      for (const child of layer.removeChildren()) child.destroy();
    }
    this.chunks = [];
    drawGroundEdge(this.edge, map.width, map.height);
    drawMapOutline(this.outline, map.width, map.height);
    for (let y = 0; y < map.height; y += GROUND_CHUNK_TILES) {
      for (let x = 0; x < map.width; x += GROUND_CHUNK_TILES) {
        const tiles = {
          x,
          y,
          w: Math.min(GROUND_CHUNK_TILES, map.width - x),
          h: Math.min(GROUND_CHUNK_TILES, map.height - y),
        };
        const chunk: GroundChunk = {
          tiles,
          // A few pixels round the diamond for the ink strokes on its edges.
          bounds: tileAreaBounds(tiles.x, tiles.y, tiles.w, tiles.h, 4),
          grass: keptGraphics(),
          grid: keptGraphics(),
          water: keptGraphics(),
          shore: keptGraphics(),
        };
        drawGrass(chunk.grass, tiles);
        drawGridLines(chunk.grid, tiles, map.width, map.height);
        drawWater(chunk.water, tiles, map);
        drawShore(chunk.shore, tiles, map);
        this.grass.addChild(chunk.grass);
        this.grid.addChild(chunk.grid);
        this.water.addChild(chunk.water);
        this.shore.addChild(chunk.shore);
        this.chunks.push(chunk);
      }
    }
  }
}

interface RunView {
  graphics: Graphics;
  bounds: Rect;
}

/**
 * Trees and forage patches, a row run to a `Graphics`, among the depth-sorted `objects` (villagers
 * and buildings sort between the runs as they would between single trees).
 */
export class MapObjectLayer {
  private readonly runs = new MapObjectRuns();
  private readonly views = new Map<string, RunView>();
  private drawnStore: Store<MapObjectComponent> | null = null;
  /** Runs redrawn since the last cull: drawn next frame even if culled (see `GroundLayer.warmUp`). */
  private fresh = new Set<RunView>();

  constructor(
    private readonly objects: Container,
    private readonly content: Content,
  ) {}

  /** Redraws the runs whose objects changed, if the store isn't the one last drawn. */
  sync(mapObject: Store<MapObjectComponent>, tile: Store<Tile>): void {
    if (mapObject === this.drawnStore) return;
    this.drawnStore = mapObject;
    for (const key of this.runs.update(mapObject, tile)) this.redraw(key);
  }

  cull(view: Rect): void {
    const fresh = this.fresh;
    this.fresh = new Set();
    for (const run of this.views.values()) {
      run.graphics.visible = fresh.has(run) || overlaps(run.bounds, view);
    }
  }

  private redraw(key: string): void {
    const objects = this.runs.objectsIn(key);
    let view = this.views.get(key);
    if (objects.length === 0) {
      view?.graphics.destroy();
      this.views.delete(key);
      return;
    }
    if (!view) {
      const graphics = keptGraphics();
      graphics.zIndex = this.runs.depthOf(key) + 1 - RUN_DEPTH_NUDGE;
      this.objects.addChild(graphics);
      view = { graphics, bounds: tileAreaBounds(0, 0, 0, 0, 0) };
      this.views.set(key, view);
    }
    const g = view.graphics;
    g.clear();
    let bounds: Rect | null = null;
    for (const obj of objects) {
      const c = tileCenterWorld(obj.x, obj.y);
      g.setTransform(1, 0, 0, 1, c.x, c.y);
      if (obj.type === 'berry_bush') drawBerryBush(g, obj.amount, obj.withered);
      else if (obj.type === 'mushroom_patch') drawMushroomPatch(g, obj.amount, obj.withered);
      else drawTree(g, obj.amount, this.content.mapObjects[obj.type].amount);
      const b = tileAreaBounds(obj.x, obj.y, 1, 1, MAP_OBJECT_ABOVE);
      bounds = bounds
        ? {
            minX: Math.min(bounds.minX, b.minX),
            minY: Math.min(bounds.minY, b.minY),
            maxX: Math.max(bounds.maxX, b.maxX),
            maxY: Math.max(bounds.maxY, b.maxY),
          }
        : b;
    }
    g.resetTransform();
    view.bounds = bounds ?? view.bounds;
    this.fresh.add(view);
  }
}
