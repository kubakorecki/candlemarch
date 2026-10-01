// The map's static layers on screen: the ground, drawn in chunks, and the map objects (trees,
// forage patches, Deposits), drawn a row run at a time (`mapObjectRuns.ts`). Each redraws only
// what changed and hides what's off-screen (`cull`). ADR-0004.
import type { Content, TerrainId } from '@candlemarch/content';
import {
  hasTile,
  type MapObjectComponent,
  type Store,
  type Tile,
  type TileBits,
} from '@candlemarch/sim';
import { Container, Graphics } from 'pixi.js';
import { gridToWorld, overlaps, type Rect, TILE_H, tileAreaBounds, tileCenterWorld } from './iso';
import { type DrawnObject, MapObjectRuns } from './mapObjectRuns';
import { MAX_RELIEF, mountainRelief } from './relief';
import {
  drawBerryBush,
  drawClayDeposit,
  drawEdges,
  drawGridLines,
  drawGroundEdge,
  drawIronDeposit,
  drawLand,
  drawMapOutline,
  drawMushroomPatch,
  drawRelief,
  drawSapling,
  drawStoneDeposit,
  drawStump,
  drawTree,
  drawWater,
  type GroundMap,
  type TileChunk,
} from './shapes';
import { treeLook } from './treeLooks';

/** Tiles a side of one ground chunk. */
const GROUND_CHUNK_TILES = 16;

/** How far a map object's art reaches over its tile's top corner (the tallest pine with its Fell pennant, and some). */
const MAP_OBJECT_ABOVE = TILE_H * 2;

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
  land: Graphics;
  grid: Graphics;
  water: Graphics;
  edges: Graphics;
  relief: Graphics;
}

/** The ground, under everything: its own render group, as it changes seldom. */
export class GroundLayer {
  readonly node = new Container({ isRenderGroup: true });
  private readonly edge = new Graphics();
  private readonly land = new Container();
  private readonly grid = new Container();
  private readonly water = new Container();
  private readonly edges = new Container();
  private readonly outline = new Graphics();
  private readonly relief = new Container();
  private chunks: GroundChunk[] = [];
  private drawn: GroundMap | null = null;
  /**
   * Set when chunks were (re)drawn: the next frame draws all of them, culled or not, so Pixi builds
   * their GPU data up front rather than in the middle of a pan.
   */
  private warmUp = false;

  constructor() {
    this.node.addChild(
      this.edge,
      this.land,
      this.grid,
      this.water,
      this.edges,
      this.outline,
      this.relief,
    );
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
      chunk.land.visible = visible;
      chunk.grid.visible = visible;
      chunk.water.visible = visible;
      chunk.edges.visible = visible;
      chunk.relief.visible = visible;
    }
  }

  private rebuild(map: GroundMap): void {
    for (const layer of [this.land, this.grid, this.water, this.edges, this.relief]) {
      for (const child of layer.removeChildren()) child.destroy();
    }
    this.chunks = [];
    drawGroundEdge(this.edge, map.width, map.height);
    drawMapOutline(this.outline, map.width, map.height);
    const heights = mountainRelief(map);
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
          // The highest peak over the top corner, and a few pixels for the ink on the edges.
          bounds: tileAreaBounds(tiles.x, tiles.y, tiles.w, tiles.h, MAX_RELIEF * TILE_H + 4),
          land: keptGraphics(),
          grid: keptGraphics(),
          water: keptGraphics(),
          edges: keptGraphics(),
          relief: keptGraphics(),
        };
        drawLand(chunk.land, tiles, map);
        drawGridLines(chunk.grid, tiles, map.width, map.height);
        drawWater(chunk.water, tiles, map);
        drawEdges(chunk.edges, tiles, map);
        drawRelief(chunk.relief, tiles, map, heights);
        this.land.addChild(chunk.land);
        this.grid.addChild(chunk.grid);
        this.water.addChild(chunk.water);
        this.edges.addChild(chunk.edges);
        this.relief.addChild(chunk.relief);
        this.chunks.push(chunk);
      }
    }
  }
}

/** Draws one map object round (0, 0), its tile's centre, each kind its own look. */
function drawMapObject(g: Graphics, obj: DrawnObject, content: Content): void {
  switch (obj.type) {
    case 'tree':
      drawTree(g, treeLook(obj.x, obj.y), obj.amount, content.mapObjects.tree.amount, obj.marked);
      break;
    case 'sapling':
      drawSapling(g, obj.stage, treeLook(obj.x, obj.y).species);
      break;
    case 'stump':
      drawStump(g, treeLook(obj.x, obj.y).species, obj.marked);
      break;
    case 'berry_bush':
      drawBerryBush(g, obj.amount, obj.withered);
      break;
    case 'mushroom_patch':
      drawMushroomPatch(g, obj.amount, obj.withered);
      break;
    case 'stone_deposit':
      drawStoneDeposit(g);
      break;
    case 'clay_deposit':
      drawClayDeposit(g);
      break;
    case 'iron_deposit':
      drawIronDeposit(g);
      break;
  }
}

/** The Revealed tiles of a map under Fog. */
export interface RevealedTiles {
  width: number;
  revealed: TileBits;
}

interface RunView {
  graphics: Graphics;
  bounds: Rect;
}

/**
 * Map objects (trees, forage patches, Deposits), a row run to a `Graphics`, among the depth-sorted `objects` (villagers
 * and buildings sort between the runs as they would between single trees).
 */
export class MapObjectLayer {
  private readonly runs = new MapObjectRuns();
  private readonly views = new Map<string, RunView>();
  private drawnStore: Store<MapObjectComponent> | null = null;
  private drawnRevealed: TileBits | null = null;
  /** Runs redrawn since the last cull: drawn next frame even if culled (see `GroundLayer.warmUp`). */
  private fresh = new Set<RunView>();

  constructor(
    private readonly objects: Container,
    private readonly content: Content,
  ) {}

  /**
   * Redraws the runs whose objects changed, if the store or the Revealed tiles aren't the ones last
   * drawn. Under Fog (`fog` not null) only objects on Revealed tiles are drawn.
   */
  sync(mapObject: Store<MapObjectComponent>, tile: Store<Tile>, fog: RevealedTiles | null): void {
    const revealed = fog?.revealed ?? null;
    if (mapObject === this.drawnStore && revealed === this.drawnRevealed) return;
    this.drawnStore = mapObject;
    this.drawnRevealed = revealed;
    const shown = fog
      ? (x: number, y: number) => hasTile(fog.revealed, y * fog.width + x)
      : undefined;
    for (const key of this.runs.update(mapObject, tile, shown)) this.redraw(key);
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
      // Where it stands: its tile's centre, moved by its offset (a tree off the centre).
      const c = tileCenterWorld(obj.x, obj.y);
      const at = gridToWorld(obj.x + 0.5 + obj.offset.x, obj.y + 0.5 + obj.offset.y);
      g.setTransform(1, 0, 0, 1, at.x, at.y);
      drawMapObject(g, obj, this.content);
      const tileBounds = tileAreaBounds(obj.x, obj.y, 1, 1, MAP_OBJECT_ABOVE);
      const b = {
        minX: tileBounds.minX + at.x - c.x,
        minY: tileBounds.minY + at.y - c.y,
        maxX: tileBounds.maxX + at.x - c.x,
        maxY: tileBounds.maxY + at.y - c.y,
      };
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
