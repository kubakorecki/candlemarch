// Hand-made map definitions and building a fresh game state from one.
import type {
  BuildingId,
  Content,
  HeroId,
  JobId,
  MapObjectId,
  ResourceAmount,
  ResourceId,
  RoadId,
  TerrainId,
} from '@candlemarch/content';
import { isMonsterRate, newDen } from './dens';
import { depositFits } from './deposits';
import { createEntity, idsOf } from './entities';
import { noTiles } from './fog';
import { refreshShade } from './forage';
import { isFood } from './granary';
import {
  canPlaceBuilding,
  doorTile,
  fitsAt,
  isWalkableTerrain,
  rectTiles,
  tileCenter,
  tileIndex,
} from './grid';
import { addHuntingGround } from './huntingGrounds';
import { seedRng } from './rng';
import { DEFAULT_MONSTER_RATE, type GameState, type Rotation, STATE_VERSION } from './state';
import {
  addToTile,
  canPlaceStockpile,
  isStockpileGood,
  placeStockpile,
  roomOnTile,
} from './stockpiles';
import { revealCamp, updateSight } from './systems/fog';
import { spawnVillager } from './villagers';
import { fullHp } from './walls';
import { maxWorkers } from './workers';

export interface MapDef {
  name: string;
  /** One string per row, all the same length. See `MAP_LEGEND`. */
  rows: string[];
  /** Tile on the map's edge where Newcomers arrive. Without one, nobody immigrates. */
  entry?: { x: number; y: number };
  /**
   * Buildings standing at map start, by origin tile, with goods already in `building.stock`:
   * a Granary's Food, a House's fuel, or a Workplace's output buffer.
   */
  buildings: {
    type: BuildingId;
    x: number;
    y: number;
    /** Quarter turns from the content layout; 0 when omitted. */
    rotation?: Rotation;
    stock?: ResourceAmount[];
  }[];
  /** Construction sites at map start, by origin tile. */
  sites?: { type: BuildingId; x: number; y: number; rotation?: Rotation }[];
  /**
   * Stockpiles at map start, by origin tile and size in tiles, with `goods` laid on their tiles
   * row by row, each tile filled to capacity before the next.
   */
  stockpiles?: { x: number; y: number; w: number; h: number; goods?: ResourceAmount[] }[];
  /** Villagers without a workplace (e.g. carriers), by tile. */
  villagers: { job: JobId; x: number; y: number }[];
  /** Where the hero starts, if the map has one. */
  hero?: { x: number; y: number };
  /** Hunting grounds: named rectangles of forest, by origin tile and size, starting full of Game. */
  huntingGrounds?: { name: string; x: number; y: number; w: number; h: number; maxGame: number }[];
}

/**
 * Whether a `type` building can start holding `stock`: Food up to a Granary's capacity, fuel up
 * to a House's buffer or what a light holds, or goods up to a Workplace's output slots.
 */
function holdsAtStart(
  content: Content,
  type: BuildingId,
  stock: Partial<Record<ResourceId, number>>,
): boolean {
  const def = content.buildings[type];
  const entries = Object.entries(stock) as [ResourceId, number][];
  if (def.foodCapacity !== undefined) {
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    return entries.every(([r]) => isFood(content, r)) && total <= def.foodCapacity;
  }
  if (def.residents !== undefined) {
    const { fuel, houseBuffer } = content.needs.cold;
    return entries.every(([r, amount]) => r === fuel && amount <= houseBuffer);
  }
  const { light } = def;
  if (light) return entries.every(([r, amount]) => r === light.fuel && amount <= light.holds);
  return entries.every(([r, amount]) =>
    (def.outputBuffer ?? []).some((slot) => slot.resource === r && amount <= slot.capacity),
  );
}

/** The hero every map spawns, until the player picks one at game start. */
const DEFAULT_HERO: HeroId = 'placeholder';

/** What each character in `MapDef.rows` stands for. A Deposit brings the terrain it stands on. */
export const MAP_LEGEND: Record<
  string,
  { terrain: TerrainId; object?: MapObjectId; road?: RoadId; den?: true }
> = {
  '.': { terrain: 'meadow' },
  ':': { terrain: 'rock' },
  '^': { terrain: 'mountain' },
  ',': { terrain: 'swamp' },
  '~': { terrain: 'river' },
  _: { terrain: 'ford' },
  '*': { terrain: 'pass_snow' },
  T: { terrain: 'meadow', object: 'tree' },
  b: { terrain: 'meadow', object: 'berry_bush' },
  m: { terrain: 'meadow', object: 'mushroom_patch' },
  s: { terrain: 'rock', object: 'stone_deposit' },
  c: { terrain: 'meadow', object: 'clay_deposit' },
  i: { terrain: 'mountain', object: 'iron_deposit' },
  '=': { terrain: 'meadow', road: 'dirt_path' },
  D: { terrain: 'meadow', den: true },
};

/**
 * A game state with an empty 0×0 map and no entities. `createInitialState` builds on it, and
 * loading fills gaps in older saves from it.
 */
export function createEmptyState(seed: number): GameState {
  return {
    version: STATE_VERSION,
    tick: 0,
    rng: seedRng(seed),
    nextId: 1,
    mapVersion: 0,
    staticVersion: 0,
    map: {
      width: 0,
      height: 0,
      terrain: [],
      roads: {},
      entry: null,
      revealed: [],
      inSight: [],
      reserve: [],
    },
    components: {
      tile: {},
      mapObject: {},
      building: {},
      site: {},
      stockpile: {},
      villager: {},
      hero: {},
      position: {},
      path: {},
      woodcutter: {},
      crafter: {},
      fisher: {},
      forager: {},
      hunter: {},
      forester: {},
      huntingGround: {},
      den: {},
      gloamling: {},
      cache: {},
    },
    logistics: { hauls: {} },
    deaths: [],
    gameOver: null,
    traffic: [],
    monsterRate: DEFAULT_MONSTER_RATE,
    fog: false,
    calms: [],
  };
}

/**
 * A new game on `map` with Monster rate `monsterRate` (0–100) and Fog on or off (`fog`; off
 * unless asked, as for every hand-made map). Everything within `fog.startRevealTiles` of what the
 * map starts with, and the entry, starts Revealed, whether Fog is on or not. Entities are created in this order:
 * map objects and Dens (row-major), buildings with their employees (spawned at the door), sites,
 * stockpiles, free villagers, the hero, then Hunting grounds. Throws if the map is malformed or
 * anything on it couldn't be placed there.
 */
export function createInitialState(
  seed: number,
  map: MapDef,
  content: Content,
  monsterRate: number = DEFAULT_MONSTER_RATE,
  fog = false,
): GameState {
  const height = map.rows.length;
  const width = map.rows[0]?.length ?? 0;
  if (width === 0) throw new Error(`map ${map.name}: empty`);
  if (!isMonsterRate(monsterRate)) throw new Error(`Monster rate ${monsterRate} isn't 0–100`);

  const state = createEmptyState(seed);
  state.monsterRate = monsterRate;
  state.map = {
    width,
    height,
    terrain: [],
    roads: {},
    entry: null,
    revealed: [],
    inSight: [],
    reserve: [],
  };
  state.map.reserve = noTiles(state.map);

  map.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`map ${map.name}: row ${y} has length ${row.length}`);
    [...row].forEach((char, x) => {
      const cell = MAP_LEGEND[char];
      if (!cell) throw new Error(`map ${map.name}: unknown character '${char}' at ${x},${y}`);
      const index = state.map.terrain.length;
      state.map.terrain.push(cell.terrain);
      if (cell.road) state.map.roads[index] = cell.road;
      if (cell.object) {
        const id = createEntity(state);
        state.components.tile[id] = { x, y };
        state.components.mapObject[id] = {
          type: cell.object,
          amount: content.mapObjects[cell.object].amount,
        };
      }
      if (cell.den) {
        const id = createEntity(state);
        state.components.tile[id] = { x, y };
        state.components.den[id] = newDen(content);
      }
    });
  });

  // Every row is laid first: whether a Deposit fits depends on the tiles round it.
  for (const id of idsOf(state.components.mapObject)) {
    const obj = state.components.mapObject[id];
    const tile = state.components.tile[id];
    if (obj && tile && !depositFits(state, content, obj.type, tile)) {
      throw new Error(`map ${map.name}: ${obj.type} can't stand at ${tile.x},${tile.y}`);
    }
  }

  refreshShade(state, content);

  if (map.entry) {
    const { x, y } = map.entry;
    const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (!onEdge || !isWalkableTerrain(state, content, { x, y })) {
      throw new Error(`map ${map.name}: entry ${x},${y} isn't walkable terrain on the map's edge`);
    }
    state.map.entry = { x, y };
  }

  for (const b of map.buildings) {
    const rotation = b.rotation ?? 0;
    if (!fitsAt(state, content, b.type, b.x, b.y, rotation)) {
      throw new Error(`map ${map.name}: ${b.type} doesn't fit at ${b.x},${b.y}`);
    }
    const def = content.buildings[b.type];
    const stock: Partial<Record<ResourceId, number>> = {};
    for (const goods of b.stock ?? []) {
      stock[goods.resource] = (stock[goods.resource] ?? 0) + goods.amount;
    }
    if (!holdsAtStart(content, b.type, stock)) {
      throw new Error(`map ${map.name}: ${b.type} at ${b.x},${b.y} can't hold its stock`);
    }
    const id = createEntity(state);
    state.components.tile[id] = { x: b.x, y: b.y };
    state.components.building[id] = {
      type: b.type,
      rotation,
      stock,
      input: {},
      workerLimit: maxWorkers(content, b.type),
      cold: false,
      lit: false,
      hp: fullHp(content, b.type),
    };
    for (const slot of def.employs) {
      for (let i = 0; i < slot.count; i++) {
        spawnVillager(state, content, slot.job, doorTile(def, { x: b.x, y: b.y }, rotation), id);
      }
    }
  }

  for (const site of map.sites ?? []) {
    const rotation = site.rotation ?? 0;
    if (!canPlaceBuilding(state, content, site.type, site.x, site.y, rotation)) {
      throw new Error(`map ${map.name}: ${site.type} site can't be placed at ${site.x},${site.y}`);
    }
    const id = createEntity(state);
    state.components.tile[id] = { x: site.x, y: site.y };
    state.components.site[id] = { type: site.type, rotation, delivered: {}, buildProgress: 0 };
  }

  for (const { x, y, w, h, goods } of map.stockpiles ?? []) {
    if (!canPlaceStockpile(state, content, x, y, w, h)) {
      throw new Error(`map ${map.name}: stockpile can't be placed at ${x},${y} (${w}×${h})`);
    }
    const id = state.nextId;
    placeStockpile(state, content, x, y, w, h);
    const pile = state.components.stockpile[id];
    const tiles = rectTiles({ x, y }, w, h).map((t) => tileIndex(state.map, t.x, t.y));
    const perTile = content.logistics.stockpileTileCapacity;
    for (const g of goods ?? []) {
      let left = g.amount;
      for (const index of tiles) {
        if (!pile || left <= 0 || !isStockpileGood(content, g.resource)) break;
        const put = Math.min(left, roomOnTile(pile, index, g.resource, perTile));
        if (put > 0) addToTile(pile, index, { resource: g.resource, amount: put });
        left -= put;
      }
      if (left > 0) {
        throw new Error(
          `map ${map.name}: stockpile at ${x},${y} can't hold ${g.amount} ${g.resource}`,
        );
      }
    }
  }

  for (const v of map.villagers) {
    if (!isWalkableTerrain(state, content, { x: v.x, y: v.y })) {
      throw new Error(
        `map ${map.name}: villager off the map or on unwalkable terrain at ${v.x},${v.y}`,
      );
    }
    spawnVillager(state, content, v.job, { x: v.x, y: v.y }, null);
  }

  if (map.hero) {
    const { x, y } = map.hero;
    if (!isWalkableTerrain(state, content, { x, y })) {
      throw new Error(`map ${map.name}: hero off the map or on unwalkable terrain at ${x},${y}`);
    }
    const id = createEntity(state);
    state.components.hero[id] = {
      type: DEFAULT_HERO,
      carrying: null,
      order: null,
      hp: content.combat.hero.hp,
      readyAt: 0,
      knockedOutUntil: null,
    };
    state.components.position[id] = tileCenter({ x, y });
  }

  for (const g of map.huntingGrounds ?? []) {
    const { name, x, y, w, h, maxGame } = g;
    if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > width || y + h > height) {
      throw new Error(
        `map ${map.name}: hunting ground ${name} doesn't fit at ${x},${y} (${w}×${h})`,
      );
    }
    addHuntingGround(state, content, name, rectTiles({ x, y }, w, h), maxGame);
  }

  // Placement above ignores Fog: it's switched on once the map stands.
  revealCamp(state, content);
  state.fog = fog;
  if (fog) updateSight(state, content);

  return state;
}
