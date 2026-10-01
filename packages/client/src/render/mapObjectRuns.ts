// Which map objects (trees, forage patches) are drawn together, and which groups need redrawing.
// Objects on one diagonal of tiles (x + y) share a draw depth, and on one diagonal they stand a
// tile width apart, so they never overlap: drawing a run of them as one shape sorts against
// villagers and buildings exactly as the objects one by one would. No Pixi here.
import type { MapObjectId } from '@candlemarch/content';
import type { EntityId, MapObjectComponent, Store, Tile } from '@candlemarch/sim';

/** Tiles of x along a diagonal that one run covers. */
export const ROW_RUN_TILES = 16;

/** What a map object looks like, as last drawn. */
export interface DrawnObject {
  type: MapObjectId;
  amount: number;
  withered: boolean;
  /** A Sapling's growth stage; 0 for anything else. */
  stage: number;
  /** Marked to fell (a tree) or dig out (a Stump). */
  marked: boolean;
  x: number;
  y: number;
}

/** The run tile (x, y) belongs to: its diagonal, and which stretch of `ROW_RUN_TILES` along it. */
function runKey(x: number, y: number): string {
  return `${x + y}:${Math.floor(x / ROW_RUN_TILES)}`;
}

export class MapObjectRuns {
  private readonly drawn = new Map<EntityId, DrawnObject>();
  private readonly members = new Map<string, Set<EntityId>>();

  /**
   * Brings the drawn objects in line with a map-object store and its tiles, and returns the runs
   * whose look changed: an object added, removed, moved, or its type, amount, withering, growth
   * stage or mark changed. A run
   * left empty is returned too, with no objects in it. Objects on tiles `shown` says no to (under
   * Fog, unrevealed ones) count as absent.
   */
  update(
    mapObject: Store<MapObjectComponent>,
    tile: Store<Tile>,
    shown: (x: number, y: number) => boolean = () => true,
  ): Set<string> {
    const dirty = new Set<string>();
    for (const [id, was] of this.drawn) {
      const at = tile[id];
      if (mapObject[id] === undefined || !at || !shown(at.x, at.y)) {
        this.remove(id, was, dirty);
      }
    }
    for (const key in mapObject) {
      const id = Number(key);
      const obj = mapObject[id] as MapObjectComponent;
      const at = tile[id];
      if (!at || !shown(at.x, at.y)) continue;
      const withered = obj.withered === true;
      const stage = obj.stage ?? 0;
      const marked = obj.marked === true;
      const was = this.drawn.get(id);
      if (
        was &&
        was.type === obj.type &&
        was.amount === obj.amount &&
        was.withered === withered &&
        was.stage === stage &&
        was.marked === marked &&
        was.x === at.x &&
        was.y === at.y
      ) {
        continue;
      }
      if (was) this.remove(id, was, dirty);
      const run = runKey(at.x, at.y);
      this.drawn.set(id, {
        type: obj.type,
        amount: obj.amount,
        withered,
        stage,
        marked,
        x: at.x,
        y: at.y,
      });
      let ids = this.members.get(run);
      if (!ids) {
        ids = new Set();
        this.members.set(run, ids);
      }
      ids.add(id);
      dirty.add(run);
    }
    return dirty;
  }

  /** The objects in run `key`, west to east. */
  objectsIn(key: string): DrawnObject[] {
    const objects: DrawnObject[] = [];
    for (const id of this.members.get(key) ?? []) {
      const obj = this.drawn.get(id);
      if (obj) objects.push(obj);
    }
    return objects.sort((a, b) => a.x - b.x);
  }

  /** The diagonal (x + y) of run `key`: every tile in it has this depth. */
  depthOf(key: string): number {
    return Number(key.slice(0, key.indexOf(':')));
  }

  /** Forgets everything drawn, as for a new map. */
  clear(): void {
    this.drawn.clear();
    this.members.clear();
  }

  private remove(id: EntityId, was: DrawnObject, dirty: Set<string>): void {
    const run = runKey(was.x, was.y);
    this.drawn.delete(id);
    const ids = this.members.get(run);
    ids?.delete(id);
    if (ids?.size === 0) this.members.delete(run);
    dirty.add(run);
  }
}
