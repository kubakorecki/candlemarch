// A* over the tile grid, 8 directions, without cutting corners past blocked tiles. Steps onto
// road tiles cost less, so walkers take roads when they're faster.
import { DIAGONAL_UNITS, TILE_UNITS } from './state';

// Neighbour offsets in a fixed order: orthogonal first, then diagonal.
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

export interface Grid {
  width: number;
  height: number;
  /** 1 where the tile can't be walked on. */
  blocked: Uint8Array;
  /** Walking speed on each tile as a percentage (100 off-road). */
  speedPercent: Uint16Array;
  /**
   * The highest speed percent any tile can have, and at least 100. Keeps the heuristic from
   * overestimating.
   */
  maxSpeedPercent: number;
}

/** Cost of crossing (dx, dy) tiles with as many diagonal steps as possible. */
function octile(dx: number, dy: number, straight = TILE_UNITS, diagonal = DIAGONAL_UNITS): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return straight * (Math.max(ax, ay) - Math.min(ax, ay)) + diagonal * Math.min(ax, ay);
}

/** Cost of a step of `length` units onto a tile walked at `percent`. */
function stepCost(length: number, percent: number): number {
  return Math.trunc((length * 100) / percent);
}

/** Octile distance between two tile indices, in sub-tile units. */
export function tileDistance(width: number, a: number, b: number): number {
  return octile((a % width) - (b % width), Math.floor(a / width) - Math.floor(b / width));
}

interface Node {
  f: number;
  h: number;
  index: number;
}

/** Orders nodes by f, then h, then tile index, so ties always break the same way. */
function before(a: Node, b: Node): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.h !== b.h) return a.h < b.h;
  return a.index < b.index;
}

function push(heap: Node[], node: Node): void {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    const p = heap[parent] as Node;
    if (!before(node, p)) break;
    heap[i] = p;
    i = parent;
  }
  heap[i] = node;
}

function pop(heap: Node[]): Node | undefined {
  const top = heap[0];
  const last = heap.pop();
  if (top === undefined || last === undefined || heap.length === 0) return top;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let smallest = last;
    let target = i;
    const left = heap[l];
    const right = heap[r];
    if (left && before(left, smallest)) {
      smallest = left;
      target = l;
    }
    if (right && before(right, smallest)) {
      smallest = right;
      target = r;
    }
    if (target === i) break;
    heap[i] = smallest;
    i = target;
  }
  heap[i] = last;
  return top;
}

/**
 * Shortest path from `start` to the nearest reachable tile in `goals` (tile indices).
 * Returns the tiles to walk through, excluding `start` and ending at the goal; `[]` when
 * `start` is already a goal; `null` when no goal is reachable. `start` itself may be blocked
 * (a villager can always walk off its tile). Blocked goals are ignored.
 */
export function findPath(grid: Grid, start: number, goals: readonly number[]): number[] | null {
  const { width, height, blocked, speedPercent } = grid;
  const size = width * height;
  const goalSet = new Set(goals.filter((g) => g >= 0 && g < size && blocked[g] === 0));
  if (goalSet.has(start)) return [];
  if (goalSet.size === 0) return null;
  const goalList = [...goalSet].sort((a, b) => a - b);

  // The cheapest a step can be: every tile at the fastest speed. Rounding per step, as the
  // real costs do, keeps the heuristic at or below the true remaining cost.
  const straightStep = stepCost(TILE_UNITS, grid.maxSpeedPercent);
  const diagonalStep = stepCost(DIAGONAL_UNITS, grid.maxSpeedPercent);
  const heuristic = (index: number): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const g of goalList) {
      const dx = (index % width) - (g % width);
      const dy = Math.floor(index / width) - Math.floor(g / width);
      best = Math.min(best, octile(dx, dy, straightStep, diagonalStep));
    }
    return best;
  };

  const cost = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open: Node[] = [];

  cost[start] = 0;
  const h0 = heuristic(start);
  push(open, { f: h0, h: h0, index: start });

  for (let node = pop(open); node !== undefined; node = pop(open)) {
    const current = node.index;
    if (closed[current] === 1) continue;
    closed[current] = 1;

    if (goalSet.has(current)) {
      const path: number[] = [];
      for (let i = current; i !== start; i = cameFrom[i] as number) path.push(i);
      return path.reverse();
    }

    const cx = current % width;
    const cy = Math.floor(current / width);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (blocked[next] === 1 || closed[next] === 1) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (blocked[cy * width + nx] === 1 || blocked[ny * width + cx] === 1)) continue;

      const length = diagonal ? DIAGONAL_UNITS : TILE_UNITS;
      const g = (cost[current] as number) + stepCost(length, speedPercent[next] as number);
      if (g < (cost[next] as number)) {
        cost[next] = g;
        cameFrom[next] = current;
        const h = heuristic(next);
        push(open, { f: g + h, h, index: next });
      }
    }
  }
  return null;
}
