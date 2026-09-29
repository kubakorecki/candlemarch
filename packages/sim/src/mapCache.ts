// Derived data about the map (walk grids, walking costs) kept between calls until the map
// changes, so systems don't rebuild it on every call. Never part of the state: it hangs off each
// state object, and is thrown away as soon as `state.mapVersion` moves on. Everything in it is
// worked out from the state alone, so it can't change a result, only how fast it comes.
import type { Content } from '@candlemarch/content';
import { type CostSearch, costSearch, type Grid } from './pathfinding';
import type { GameState } from './state';

interface MapCache {
  /** The `mapVersion` and content the entries were worked out for. */
  version: number;
  content: Content;
  entries: Map<string, unknown>;
  /** Walking-cost searches by grid and start tile, oldest first, at most `SEARCHES_KEPT`. */
  searches: Map<string, CostSearch>;
}

/**
 * How many walking-cost searches a cache keeps: enough for every Carrier and pickup in use, while
 * a map that doesn't change for a long time can't pile them up.
 */
const SEARCHES_KEPT = 64;

const caches = new WeakMap<GameState, MapCache>();

/**
 * Records that what blocks walking, road speed or Light has changed: something standing on a tile
 * was added or removed, a site was finished, a wall was battered down or put back up, a road was
 * laid or removed, or lights were lit or put out. Everything cached for the old map is dropped.
 */
export function mapChanged(state: GameState): void {
  state.mapVersion += 1;
}

/**
 * The value cached under `key` for `state`'s map, built with `build` the first time it's asked
 * for since the map last changed. Callers must treat it as read-only.
 */
export function cached<T>(state: GameState, content: Content, key: string, build: () => T): T {
  const { entries } = cacheOf(state, content);
  if (entries.has(key)) return entries.get(key) as T;
  const value = build();
  entries.set(key, value);
  return value;
}

/**
 * Walking costs from tile `start` over `grid`, one of `state`'s cached grids named `gridKey`
 * (`costSearch`). The search is kept until the map changes, so asking again from the same tile,
 * such as an idle Carrier looking for work each tick, costs next to nothing.
 */
export function cachedCosts(
  state: GameState,
  content: Content,
  gridKey: string,
  grid: Grid,
  start: number,
): CostSearch {
  const { searches } = cacheOf(state, content);
  const key = `${gridKey}:${start}`;
  let search = searches.get(key);
  if (!search) {
    search = costSearch(grid, start);
    searches.set(key, search);
    if (searches.size > SEARCHES_KEPT) {
      const oldest = searches.keys().next().value;
      if (oldest !== undefined) searches.delete(oldest);
    }
  }
  return search;
}

/** `state`'s cache, emptied first if the map or content has changed since it was filled. */
function cacheOf(state: GameState, content: Content): MapCache {
  let cache = caches.get(state);
  if (!cache || cache.version !== state.mapVersion || cache.content !== content) {
    cache = { version: state.mapVersion, content, entries: new Map(), searches: new Map() };
    caches.set(state, cache);
  }
  return cache;
}

/**
 * Hands `from`'s cache to `to`, a copy of it (`step` calls this). `to` gets its own list of
 * entries, so the two can change apart; while their maps are alike they share the values.
 */
export function inheritMapCache(from: GameState, to: GameState): void {
  const cache = caches.get(from);
  if (cache) {
    caches.set(to, {
      ...cache,
      entries: new Map(cache.entries),
      searches: new Map(cache.searches),
    });
  }
}
