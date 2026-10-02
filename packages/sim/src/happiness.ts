// Happiness (spec, Villagers: Happiness in M5). Each villager has a score from 0 to
// `happiness.max`: `happiness.start` plus its sources, worked out from state each time it's asked
// (nothing stored but the Unhappy Dawns in a row). It's about the good life, not survival: Hungry,
// Cold and Tired keep their own slowdowns and don't count here. The band (Happy, Content,
// Unhappy) speeds or slows work; Unhappy too long, a villager leaves the village.
//
// Adjacency (spec, Villagers: Adjacency in M5): a built building's or point of interest's
// `adjacency`, and woods (standing trees and Reserve tiles, one kind), reach `reachTiles`
// (Chebyshev) from their footprint to a House's and touch its residents, each kind once.
import type { BuildingId, Content, PoiId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { hasTile } from './fog';
import { type BuildingLayout, buildingLayout, entityLayout, tileIndex } from './grid';
import { cached } from './mapCache';
import type { EntityId, GameState, Rotation, Tile, VillagerComponent } from './state';

/** One thing raising or lowering a villager's score, and by how much. */
export type HappinessSource =
  | { kind: 'homeless'; value: number }
  /** Deaths in the village on the last `deathDays` days. */
  | { kind: 'deaths'; deaths: number; value: number }
  /** Standing trees or a Reserve near its House. */
  | { kind: 'woods'; value: number }
  /** A point of interest near its House, such as the Shrine. */
  | { kind: 'poi'; poi: PoiId; value: number }
  /** A building near its House, such as the smokehouse. */
  | { kind: 'building'; building: BuildingId; value: number };

/** A rectangle of tiles: a building's body. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Happy (works faster), Content, or Unhappy (works slower, and leaves if it lasts). */
export type HappinessBand = 'happy' | 'content' | 'unhappy';

/** Whether villager `v` has quit the village and is walking out of it. */
export function isLeaving(v: VillagerComponent): boolean {
  return v.routine === 'leaving';
}

/** Deaths in the village on the last `deathDays` days, today included. */
function recentDeaths(state: GameState, content: Content): number {
  const today = calendarAt(state.tick, content).day;
  let count = 0;
  // Deaths are recorded oldest first.
  for (let i = state.deaths.length - 1; i >= 0; i--) {
    const death = state.deaths[i];
    if (!death || today - death.day >= content.happiness.deathDays) break;
    count += 1;
  }
  return count;
}

/** What raises or lowers villager `id`'s score now, in a fixed order; empty for none. */
export function happinessSources(
  state: GameState,
  content: Content,
  id: EntityId,
): HappinessSource[] {
  const v = state.components.villager[id];
  if (!v) return [];
  const sources: HappinessSource[] = [];
  if (v.home === null) sources.push({ kind: 'homeless', value: content.happiness.homeless });
  const deaths = recentDeaths(state, content);
  if (deaths > 0) sources.push({ kind: 'deaths', deaths, value: deaths * content.happiness.death });
  const house = v.home === null ? null : entityLayout(state, content, v.home);
  if (house) sources.push(...adjacencyAt(state, content, bodyOf(house)));
  return sources;
}

/** The body of a laid-out building, without its yard. */
function bodyOf(layout: BuildingLayout): Rect {
  return { x: layout.origin.x, y: layout.origin.y, w: layout.size.w, h: layout.size.h };
}

/** Tiles apart, Chebyshev, between the nearest tiles of `a` and `b`: 0 when they overlap. */
function tilesApart(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w - 1), a.x - (b.x + b.w - 1));
  const dy = Math.max(0, b.y - (a.y + a.h - 1), a.y - (b.y + b.h - 1));
  return Math.max(dx, dy);
}

/** Which tiles hold a standing tree (`happiness.woods.objects`), by tile index. */
function treeTiles(state: GameState, content: Content): Uint8Array {
  return cached(state, content, 'treeTiles', () => {
    const { map } = state;
    const { mapObject, tile } = state.components;
    const trees = new Uint8Array(map.width * map.height);
    for (const id of idsOf(mapObject)) {
      const o = mapObject[id];
      const at = tile[id];
      if (o && at && content.happiness.woods.objects.includes(o.type)) {
        trees[tileIndex(map, at.x, at.y)] = 1;
      }
    }
    return trees;
  });
}

/** Whether a standing tree or a Reserve tile lies within `reach` tiles of `rect`. */
function woodsNear(state: GameState, content: Content, rect: Rect, reach: number): boolean {
  const { map } = state;
  const trees = treeTiles(state, content);
  const y1 = Math.min(map.height - 1, rect.y + rect.h - 1 + reach);
  const x1 = Math.min(map.width - 1, rect.x + rect.w - 1 + reach);
  for (let y = Math.max(0, rect.y - reach); y <= y1; y++) {
    for (let x = Math.max(0, rect.x - reach); x <= x1; x++) {
      const i = tileIndex(map, x, y);
      if (trees[i] === 1 || hasTile(map.reserve, i)) return true;
    }
  }
  return false;
}

/**
 * What a House whose body is `rect` gets from its neighbours: woods, then points of interest and
 * built buildings with an `adjacency`, each kind once, in content order.
 */
function adjacencyAt(state: GameState, content: Content, rect: Rect): HappinessSource[] {
  const { reachTiles, woods } = content.happiness;
  const sources: HappinessSource[] = [];
  if (woodsNear(state, content, rect, reachTiles))
    sources.push({ kind: 'woods', value: woods.value });

  const { poi, tile, building } = state.components;
  const pois = new Set<PoiId>();
  for (const id of idsOf(poi)) {
    const p = poi[id];
    const at = tile[id];
    if (!p || !at || content.pois[p.kind].adjacency === undefined) continue;
    if (tilesApart(rect, { x: at.x, y: at.y, w: 1, h: 1 }) <= reachTiles) pois.add(p.kind);
  }
  for (const kind of Object.keys(content.pois) as PoiId[]) {
    const value = content.pois[kind].adjacency;
    if (value !== undefined && pois.has(kind)) sources.push({ kind: 'poi', poi: kind, value });
  }

  const types = new Set<BuildingId>();
  for (const id of idsOf(building)) {
    const b = building[id];
    if (!b || content.buildings[b.type].adjacency === undefined || types.has(b.type)) continue;
    const layout = entityLayout(state, content, id);
    if (layout && tilesApart(rect, bodyOf(layout)) <= reachTiles) types.add(b.type);
  }
  for (const type of Object.keys(content.buildings) as BuildingId[]) {
    const value = content.buildings[type].adjacency;
    if (value !== undefined && types.has(type)) {
      sources.push({ kind: 'building', building: type, value });
    }
  }
  return sources;
}

/**
 * What placing a `type` building at `origin` would do, for the placement preview. A House: what
 * its neighbours would add up to. A building with a like or dislike: the change it would make to
 * each House in reach (0 where one of its type already reaches), Houses in ID order. Null for any
 * other building.
 */
export type AdjacencyPreview =
  | { kind: 'house'; sources: HappinessSource[]; total: number }
  | { kind: 'neighbours'; houses: { house: EntityId; value: number }[] };

export function adjacencyPreview(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): AdjacencyPreview | null {
  const def = content.buildings[type];
  const rect = bodyOf(buildingLayout(def, origin, rotation));
  if ((def.residents ?? 0) > 0) {
    const sources = adjacencyAt(state, content, rect);
    return { kind: 'house', sources, total: sources.reduce((sum, s) => sum + s.value, 0) };
  }
  if (def.adjacency === undefined) return null;
  const houses: { house: EntityId; value: number }[] = [];
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    const layout = entityLayout(state, content, id);
    if (!b || !layout || (content.buildings[b.type].residents ?? 0) === 0) continue;
    const house = bodyOf(layout);
    if (tilesApart(house, rect) > content.happiness.reachTiles) continue;
    const has = adjacencyAt(state, content, house).some(
      (s) => s.kind === 'building' && s.building === type,
    );
    houses.push({ house: id, value: has ? 0 : def.adjacency });
  }
  return { kind: 'neighbours', houses };
}

/** Villager `id`'s score: the start plus its sources, from 0 to `happiness.max`. */
export function happiness(state: GameState, content: Content, id: EntityId): number {
  let score = content.happiness.start;
  for (const source of happinessSources(state, content, id)) score += source.value;
  return Math.min(content.happiness.max, Math.max(0, score));
}

/** The band a score falls in. */
export function happinessBand(content: Content, score: number): HappinessBand {
  if (score >= content.happiness.happyAt) return 'happy';
  if (score < content.happiness.unhappyBelow) return 'unhappy';
  return 'content';
}

/**
 * How fast villager `id` works for its happiness, as a percent of normal: Happy
 * `happySpeedPercent`, Unhappy `unhappySpeedPercent`, else 100 (and 100 for anyone not a
 * villager, such as the Hero).
 */
export function happinessSpeedPercent(state: GameState, content: Content, id: EntityId): number {
  if (!state.components.villager[id]) return 100;
  const band = happinessBand(content, happiness(state, content, id));
  if (band === 'happy') return content.happiness.happySpeedPercent;
  if (band === 'unhappy') return content.happiness.unhappySpeedPercent;
  return 100;
}

/**
 * Whether the villagers' average score is in the Unhappy band (those leaving don't count). No
 * Newcomer comes while it is.
 */
export function isVillageUnhappy(state: GameState, content: Content): boolean {
  const { villager } = state.components;
  let total = 0;
  let count = 0;
  for (const id of idsOf(villager)) {
    const v = villager[id];
    if (!v || isLeaving(v)) continue;
    total += happiness(state, content, id);
    count += 1;
  }
  return count > 0 && total < content.happiness.unhappyBelow * count;
}
