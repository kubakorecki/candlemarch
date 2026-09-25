// The flag-relay road network, derived from roads, placed Flags and doors: which tiles are Flags,
// the Segments between them, and routes from Flag to Flag. A Flag's ID is its tile index.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import { entityDoor, inBounds, stockpileTileIndices, tileAt, tileIndex } from '../grid';
import { roadNeighbours } from '../roads';
import type { EntityId, GameState, MapState } from '../state';
import { type FlagRelayState, relayOf, type Segment } from './relayState';

/** Door Flags: the door tile of every building and site whose door is on a road. */
export function doorFlags(state: GameState, content: Content): Map<number, EntityId> {
  const { map } = state;
  const doors = new Map<number, EntityId>();
  for (const id of idsOf(state.components.tile)) {
    const door = entityDoor(state, content, id);
    if (!door || !inBounds(map, door.x, door.y)) continue;
    const i = tileIndex(map, door.x, door.y);
    if (map.roads[i] !== undefined && !doors.has(i)) doors.set(i, id);
  }
  return doors;
}

/** Every Flag tile: placed Flags still on a road, and door Flags. */
export function flagTiles(state: GameState, content: Content, relay: FlagRelayState): Set<number> {
  const tiles = new Set(relay.flags.filter((i) => state.map.roads[i] !== undefined));
  for (const i of doorFlags(state, content).keys()) tiles.add(i);
  return tiles;
}

/**
 * Whether a Flag can be placed on tile (x, y): the game uses flag relay, and the tile is a path
 * tile that isn't a Flag or next to one along the path.
 */
export function canPlaceFlag(state: GameState, content: Content, x: number, y: number): boolean {
  const relay = relayOf(state);
  const { map } = state;
  if (!relay || !inBounds(map, x, y)) return false;
  const i = tileIndex(map, x, y);
  if (map.roads[i] === undefined) return false;
  const existing = flagTiles(state, content, relay);
  return !existing.has(i) && roadNeighbours(map, i).every((n) => !existing.has(n));
}

/**
 * The Segments between neighbouring Flags: for each pair of Flags joined by road tiles that
 * aren't Flags, the shortest such road (ties by the fixed neighbour order). Ordered by their
 * ends.
 */
export function deriveSegments(state: GameState, flags: Set<number>): Segment[] {
  const { map } = state;
  const segments: Segment[] = [];
  for (const from of [...flags].sort((a, b) => a - b)) {
    // Breadth-first over road tiles from `from`, stopping at Flags.
    const cameFrom = new Map<number, number>([[from, from]]);
    const reached: number[] = [];
    let frontier = [from];
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const tile of frontier) {
        for (const n of roadNeighbours(map, tile)) {
          if (cameFrom.has(n)) continue;
          cameFrom.set(n, tile);
          if (flags.has(n)) reached.push(n);
          else next.push(n);
        }
      }
      frontier = next;
    }
    for (const to of reached.filter((t) => t > from).sort((a, b) => a - b)) {
      const tiles = [to];
      for (let t = to; t !== from; t = cameFrom.get(t) as number)
        tiles.push(cameFrom.get(t) as number);
      segments.push({ ends: [from, to], tiles: tiles.reverse() });
    }
  }
  return segments;
}

/** Placed Flags serving stockpile `pile`: those orthogonally next to one of its tiles. */
export function stockpileFlags(state: GameState, relay: FlagRelayState, pile: EntityId): number[] {
  const tiles = new Set(stockpileTileIndices(state, pile));
  return relay.flags.filter(
    (f) =>
      state.map.roads[f] !== undefined &&
      orthogonalNeighbours(state.map, f).some((n) => tiles.has(n)),
  );
}

/** Tile indices sharing an edge with tile `index`, on the map. */
function orthogonalNeighbours(map: MapState, index: number): number[] {
  const { x, y } = tileAt(map, index);
  const result: number[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const) {
    if (inBounds(map, x + dx, y + dy)) result.push(tileIndex(map, x + dx, y + dy));
  }
  return result;
}

/** The road network for one tick: Flags, the Segments joining them, and routes between them. */
export interface Network {
  flags: Set<number>;
  /** For each Flag, the Flags a Segment joins it to, and that Segment's length in steps. */
  neighbours: Map<number, { flag: number; length: number }[]>;
  /** Route lengths to a Flag from every Flag that can reach it; filled in as asked for. */
  distances: Map<number, Map<number, number>>;
}

export function buildNetwork(flags: Set<number>, segments: readonly Segment[]): Network {
  const neighbours = new Map<number, { flag: number; length: number }[]>();
  for (const f of flags) neighbours.set(f, []);
  for (const { ends, tiles } of segments) {
    const [a, b] = ends;
    neighbours.get(a)?.push({ flag: b, length: tiles.length - 1 });
    neighbours.get(b)?.push({ flag: a, length: tiles.length - 1 });
  }
  return { flags, neighbours, distances: new Map() };
}

/** Shortest route length along Segments from every Flag that can reach `target`. */
export function distancesTo(net: Network, target: number): Map<number, number> {
  const cached = net.distances.get(target);
  if (cached) return cached;
  // Dijkstra; the network is small, so a plain scan for the nearest open Flag is enough.
  const dist = new Map<number, number>([[target, 0]]);
  const done = new Set<number>();
  for (;;) {
    let current: number | undefined;
    for (const [flag, d] of dist) {
      if (done.has(flag)) continue;
      const best = current === undefined ? undefined : dist.get(current);
      if (best === undefined || d < best || (d === best && flag < (current as number))) {
        current = flag;
      }
    }
    if (current === undefined) break;
    done.add(current);
    const base = dist.get(current) as number;
    for (const { flag, length } of net.neighbours.get(current) ?? []) {
      const d = base + length;
      if (d < (dist.get(flag) ?? Number.POSITIVE_INFINITY)) dist.set(flag, d);
    }
  }
  net.distances.set(target, dist);
  return dist;
}

/**
 * The next Flag on the shortest route from `from` to `to`: the neighbour minimising Segment
 * length plus its route length to `to`, ties to the lowest Flag ID. Null if `to` can't be
 * reached or `from` is `to`.
 */
export function nextHop(net: Network, from: number, to: number): number | null {
  if (from === to) return null;
  const dist = distancesTo(net, to);
  let best: { flag: number; cost: number } | null = null;
  for (const { flag, length } of net.neighbours.get(from) ?? []) {
    const rest = dist.get(flag);
    if (rest === undefined) continue;
    const cost = length + rest;
    if (!best || cost < best.cost || (cost === best.cost && flag < best.flag))
      best = { flag, cost };
  }
  return best?.flag ?? null;
}
