// How high each Mountain tile rises: foothills where the Mountains meet open land, higher the
// deeper into the range (toward the Valley's rim), each tile a little higher or lower than its
// neighbours. Worked out from the terrain alone, so the same map always stands the same. No Pixi.
import type { GroundMap } from './shapes';
import { tileHash } from './treeLooks';

/** A foothill's height, in tile heights (`TILE_H`): a Mountain tile next to open land. */
const FOOT_RELIEF = 0.4;
/** How much higher each tile further from open land stands, up to `TOP_RELIEF`. */
const RELIEF_STEP = 0.25;
const TOP_RELIEF = 1.4;
/** How far a tile may stand above or below the height for its distance, as a fraction of it. */
const RELIEF_JITTER = 0.2;

/** The highest any Mountain tile rises, in tile heights. */
export const MAX_RELIEF = TOP_RELIEF * (1 + RELIEF_JITTER);

/**
 * The height of every tile of `map`, row-major like its terrain, in tile heights: 0 off the
 * Mountains; on them, from `FOOT_RELIEF` beside open land (anything but Mountain, Pass snow
 * included) rising `RELIEF_STEP` a tile further in (counted in steps along the grid) to
 * `TOP_RELIEF`, then moved up or down by up to `RELIEF_JITTER` from a hash of the tile. The rise
 * is gentler than the camera's view down, so the Mountains never hide the land behind them.
 */
export function mountainRelief(map: GroundMap): Float32Array {
  const { width, height, terrain } = map;
  const n = width * height;
  // Distance from open land, by a breadth-first flood from every open tile.
  const distance = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (terrain[i] !== 'mountain') {
      distance[i] = 0;
      queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head] as number;
    const x = i % width;
    const next = (distance[i] as number) + 1;
    for (const j of [i - width, i + width, x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1]) {
      if (j < 0 || j >= n || distance[j] !== -1) continue;
      distance[j] = next;
      queue[tail++] = j;
    }
  }
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (terrain[i] !== 'mountain') continue;
    const d = distance[i] as number;
    // A map of nothing but Mountain has no open land to measure from: all of it is high.
    const base = d < 0 ? TOP_RELIEF : Math.min(TOP_RELIEF, FOOT_RELIEF + RELIEF_STEP * (d - 1));
    const x = i % width;
    const y = (i - x) / width;
    const jitter = ((tileHash(x, y, 9) % 9) - 4) / 4; // −1 to 1
    heights[i] = base * (1 + RELIEF_JITTER * jitter);
  }
  return heights;
}
