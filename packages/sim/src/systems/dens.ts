// Monster Dens at work. At each Dusk every Den spawns its season's Gloamlings on its tile, scaled
// by the Monster rate (`trunc(n × rate ÷ 100)`). At each Dawn every Gloamling still out vanishes,
// and at the first Dawn of each season but the first, every Den buds: a new Den closer to the
// village (see `budDens`), never inside a cleared Den's calm area; calm areas that have ended are
// dropped first. At Monster rate 0 nothing spawns or buds, and Gloamlings out vanish at once.
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn, isDusk } from '../calendar';
import { inCalmArea, newDen } from '../dens';
import { createEntity, destroyEntity, idsOf } from '../entities';
import {
  blockedGrid,
  entityLayout,
  inBounds,
  tileCenter,
  tileIndex,
  tilesUnderCaches,
  tilesUnderStockpiles,
} from '../grid';
import { lightReachGrid } from '../lights';
import { randomInt } from '../rng';
import type { GameState } from '../state';

export function densSystem(state: GameState, content: Content): void {
  if (state.monsterRate === 0) clearGloamlings(state);
  if (isDawn(state.tick, content)) {
    clearGloamlings(state);
    state.calms = state.calms.filter((c) => state.tick < c.until);
    const { day, dayOfSeason } = calendarAt(state.tick, content);
    // The game starts at a season's first Dawn, before any Den has stood through a season.
    if (day > 1 && dayOfSeason === 1 && state.monsterRate > 0) budDens(state, content);
  }
  if (isDusk(state.tick, content)) spawnGloamlings(state, content);
}

function clearGloamlings(state: GameState): void {
  for (const id of idsOf(state.components.gloamling)) destroyEntity(state, id);
}

function spawnGloamlings(state: GameState, content: Content): void {
  const { den, tile } = state.components;
  const perDen = content.dens.spawnsPerDusk[calendarAt(state.tick, content).season];
  const count = Math.trunc((perDen * state.monsterRate) / 100);
  for (const denId of idsOf(den)) {
    const at = tile[denId];
    if (!at) continue;
    for (let i = 0; i < count; i++) {
      const id = createEntity(state);
      state.components.gloamling[id] = {
        den: denId,
        hp: content.combat.gloamling.hp,
        readyAt: 0,
        target: null,
      };
      state.components.position[id] = tileCenter(at);
    }
  }
}

/**
 * For each tile, its Chebyshev distance to the nearest building or construction site footprint
 * tile, by tile index; null when there's none on the map.
 */
function distanceToBuildings(state: GameState, content: Content): Int32Array | null {
  const { map } = state;
  const distance = new Int32Array(map.width * map.height).fill(-1);
  let queue: number[] = [];
  for (const id of idsOf(state.components.tile)) {
    for (const t of entityLayout(state, content, id)?.tiles ?? []) {
      const i = tileIndex(map, t.x, t.y);
      if (inBounds(map, t.x, t.y) && distance[i] === -1) {
        distance[i] = 0;
        queue.push(i);
      }
    }
  }
  if (queue.length === 0) return null;
  // Breadth-first over the 8 neighbours: steps counted that way are Chebyshev distance.
  for (let d = 1; queue.length > 0; d++) {
    const next: number[] = [];
    for (const i of queue) {
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!inBounds(map, x + dx, y + dy)) continue;
          const n = tileIndex(map, x + dx, y + dy);
          if (distance[n] !== -1) continue;
          distance[n] = d;
          next.push(n);
        }
      }
    }
    queue = next;
  }
  return distance;
}

/**
 * Tiles a Den could stand on, by tile index: dark (out of every light's reach, fuelled or not),
 * walkable, out of every calm area, and free of map objects, buildings, sites, roads, stockpiles,
 * caches, Dens and the entry tile.
 */
function openTiles(state: GameState, content: Content): boolean[] {
  const { map } = state;
  const blocked = blockedGrid(state, content);
  const piles = tilesUnderStockpiles(state);
  const caches = tilesUnderCaches(state);
  const lightReach = lightReachGrid(state, content);
  const open = Array.from(
    { length: map.width * map.height },
    (_, i) =>
      blocked[i] === 0 &&
      lightReach[i] === 0 &&
      map.roads[i] === undefined &&
      !piles.has(i) &&
      !caches.has(i) &&
      !inCalmArea(state, content, { x: i % map.width, y: Math.floor(i / map.width) }),
  );
  if (map.entry) open[tileIndex(map, map.entry.x, map.entry.y)] = false;
  // Dens, and map objects walked over (Saplings), which will grow into trees.
  for (const id of [...idsOf(state.components.den), ...idsOf(state.components.mapObject)]) {
    const t = state.components.tile[id];
    if (t) open[tileIndex(map, t.x, t.y)] = false;
  }
  return open;
}

/**
 * Each Den, in ID order, buds while the map holds fewer than `maxDens`: a new Den on an open tile
 * within `closerMax` tiles of it (Chebyshev) that is `closerMin`–`closerMax` tiles closer to the
 * nearest building and at least `minBuildingTiles` from every building and site. The PRNG picks
 * among those tiles in index order; a Den with none doesn't bud. Buds don't bud until next season.
 */
function budDens(state: GameState, content: Content): void {
  const { closerMin, closerMax, minBuildingTiles, maxDens } = content.dens.budding;
  const { map } = state;
  const { den, tile } = state.components;
  const parents = idsOf(den);
  if (parents.length === 0 || parents.length >= maxDens) return;
  const toVillage = distanceToBuildings(state, content);
  if (!toVillage) return;
  const open = openTiles(state, content);

  for (const parent of parents) {
    if (idsOf(den).length >= maxDens) return;
    const from = tile[parent];
    if (!from) continue;
    const reach = toVillage[tileIndex(map, from.x, from.y)] ?? 0;
    const candidates: number[] = [];
    for (let y = from.y - closerMax; y <= from.y + closerMax; y++) {
      for (let x = from.x - closerMax; x <= from.x + closerMax; x++) {
        if (!inBounds(map, x, y)) continue;
        const i = tileIndex(map, x, y);
        const d = toVillage[i] ?? 0;
        const closer = reach - d;
        if (open[i] && closer >= closerMin && closer <= closerMax && d >= minBuildingTiles) {
          candidates.push(i);
        }
      }
    }
    if (candidates.length === 0) continue;
    const pick = candidates[randomInt(state, candidates.length)] as number;
    open[pick] = false;
    const id = createEntity(state);
    state.components.tile[id] = { x: pick % map.width, y: Math.floor(pick / map.width) };
    den[id] = newDen(content);
  }
}
