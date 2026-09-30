// Sight under Fog (spec, World and map; ADR-0005). While Fog is on, works out the tiles In sight
// from the Hero, villagers, finished buildings, watchtowers with their Watchman and lit lights,
// and Reveals them for good. It works them out again only when a source's tile or reach has
// changed: someone crossed into another tile, Dusk or Dawn, a building finished or removed, a
// light lit or out, a watchtower's Watchman come or gone.
import type { Content, SightDef } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { noTiles, setTile } from '../fog';
import { entityLayout, stockpileTileIndices, tileAt } from '../grid';
import { lightDef } from '../lights';
import { staticChanged } from '../snapshot';
import type { EntityId, GameState, MapState, Tile, TileBits } from '../state';
import { workersAt } from '../workers';
import { villagerTile } from './movement';

/**
 * Tiles a source stands on and how far round them it sees (Chebyshev). `id` names where it
 * stands: a walker's tile index, or a building's ID negated (a building never moves).
 */
interface Sight {
  id: number;
  tiles: Tile[];
  radius: number;
}

/**
 * The key and In-sight tiles each state last worked out, so a tick whose sources are unchanged
 * skips the work. Never part of the state: a state without an entry (a copy, a loaded save) just
 * works them out again, to the same result.
 */
const lastSight = new WeakMap<GameState, { key: number[]; inSight: TileBits }>();

export function fogSystem(state: GameState, content: Content): void {
  if (state.fog) updateSight(state, content);
}

/**
 * Works out the tiles In sight into `state.map.inSight` and Reveals them, unless nothing that
 * decides them changed since this state last did. Only while Fog is on.
 */
export function updateSight(state: GameState, content: Content): void {
  const { map } = state;
  const sights = sightSources(state, content);
  // Equal keys give equal sight.
  const key = sights.flatMap((s) => [s.id, s.radius]);
  const last = lastSight.get(state);
  if (last && last.inSight === map.inSight && sameNumbers(last.key, key)) return;
  const inSight = noTiles(map);
  for (const s of sights) cover(inSight, map, s.tiles, s.radius);
  map.inSight = inSight;
  if (reveal(map, inSight)) staticChanged(state);
  lastSight.set(state, { key, inSight });
}

/**
 * Reveals everything within `startRevealTiles` of the Camp (what the map starts with: buildings,
 * sites, Stockpiles, villagers and the Hero), plus the entry tile. For a new game.
 */
export function revealCamp(state: GameState, content: Content): void {
  const { map, components } = state;
  const camp: Tile[] = [];
  for (const id of [...idsOf(components.building), ...idsOf(components.site)]) {
    camp.push(...(entityLayout(state, content, id)?.tiles ?? []));
  }
  for (const id of idsOf(components.stockpile)) {
    for (const i of stockpileTileIndices(state, id)) camp.push(tileAt(map, i));
  }
  for (const id of [...idsOf(components.villager), ...idsOf(components.hero)]) {
    const at = villagerTile(state, id);
    if (at) camp.push(at);
  }
  const revealed = noTiles(map);
  cover(revealed, map, camp, content.fog.startRevealTiles);
  if (map.entry) cover(revealed, map, [map.entry], 0);
  map.revealed = revealed;
}

/** Every sight source in the state: villagers and the Hero by ID, then buildings by ID. */
function sightSources(state: GameState, content: Content): Sight[] {
  const { map } = state;
  const { sight } = content.fog;
  const time = isNight(state.tick, content) ? 'night' : 'day';
  const { villager, hero, building } = state.components;
  const sights: Sight[] = [];
  const walkers: [EntityId[], SightDef][] = [
    [idsOf(villager), sight.villager],
    [idsOf(hero), sight.hero],
  ];
  for (const [ids, def] of walkers) {
    for (const id of ids) {
      const at = villagerTile(state, id);
      if (at) sights.push({ id: at.y * map.width + at.x, tiles: [at], radius: def[time] });
    }
  }
  for (const id of idsOf(building)) {
    const b = building[id];
    const layout = entityLayout(state, content, id);
    if (!b || !layout) continue;
    const manned = content.buildings[b.type].watch !== undefined && workersAt(state, id).length > 0;
    let radius = (manned ? sight.mannedWatchtower : sight.building)[time];
    const light = lightDef(state, content, id);
    // A lit light sees its lit tiles: its Light's reach round its footprint.
    if (light && b.lit) radius = Math.max(radius, light.radiusTiles);
    sights.push({ id: -id, tiles: layout.tiles, radius });
  }
  return sights;
}

/** Sets every tile of `map` within `radius` of any of `tiles` (Chebyshev) in `bits`. */
function cover(bits: TileBits, map: MapState, tiles: readonly Tile[], radius: number): void {
  for (const t of tiles) {
    const x0 = Math.max(0, t.x - radius);
    const x1 = Math.min(map.width - 1, t.x + radius);
    const y0 = Math.max(0, t.y - radius);
    const y1 = Math.min(map.height - 1, t.y + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) setTile(bits, y * map.width + x);
    }
  }
}

/** Adds `inSight` to `map.revealed`; whether that Revealed any tile. */
function reveal(map: MapState, inSight: TileBits): boolean {
  const { revealed } = map;
  let changed = false;
  inSight.forEach((bits, i) => {
    const was = revealed[i] ?? 0;
    const now = was | bits;
    if (now !== was) {
      revealed[i] = now;
      changed = true;
    }
  });
  return changed;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
