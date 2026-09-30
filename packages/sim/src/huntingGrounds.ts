// Hunting grounds: sets of Forest tiles holding Game. The ceiling follows the trees standing on a
// ground; felling one drives the Game above the new ceiling away at once. Under the ceiling Game
// recovers, one animal every few days; a ground hunted empty stays empty for a couple of seasons.
import type { BuildingId, Content } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { createEntity, idsOf } from './entities';
import { refreshShade } from './forage';
import { leaveStump } from './forest';
import { inWorkRadius } from './gathering';
import { buildingLayout, inBounds, tileAt, tileIndex } from './grid';
import { staticChanged } from './snapshot';
import type { EntityId, GameState, HuntingGroundComponent, Rotation, Tile } from './state';

/** The health word for a ground, from its Game as a share of its max Game. */
export type GroundHealth = 'thriving' | 'thinning' | 'scarce' | 'empty';

/**
 * Adds a Hunting ground over `tiles` (any order; repeats count once), full of Game, and returns its
 * ID. Its start trees are the forest standing on those tiles now, so add it once the map's trees
 * stand. Hand-made maps add their rectangles through it; a generator can add any tile set.
 */
export function addHuntingGround(
  state: GameState,
  content: Content,
  name: string,
  tiles: readonly Tile[],
  maxGame: number,
): EntityId {
  for (const t of tiles) {
    if (!inBounds(state.map, t.x, t.y)) {
      throw new Error(`hunting ground ${name}: tile ${t.x},${t.y} is off the map`);
    }
  }
  const indices = [...new Set(tiles.map((t) => tileIndex(state.map, t.x, t.y)))].sort(
    (a, b) => a - b,
  );
  const ground: HuntingGroundComponent = {
    name,
    tiles: indices,
    maxGame,
    game: maxGame,
    startTrees: 0,
    fled: 0,
    regrowsOn: null,
  };
  ground.startTrees = standingTrees(state, content, ground);
  const id = createEntity(state);
  state.components.huntingGround[id] = ground;
  staticChanged(state);
  return id;
}

/** Whether `tile` is one of `ground`'s tiles. */
export function inGround(state: GameState, ground: HuntingGroundComponent, tile: Tile): boolean {
  if (!inBounds(state.map, tile.x, tile.y)) return false;
  const index = tileIndex(state.map, tile.x, tile.y);
  // Binary search: the tiles are ascending.
  let lo = 0;
  let hi = ground.tiles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = ground.tiles[mid] as number;
    if (at === index) return true;
    if (at < index) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** `ground`'s tiles, row-major. */
export function groundTiles(state: GameState, ground: HuntingGroundComponent): Tile[] {
  return ground.tiles.map((i) => tileAt(state.map, i));
}

/**
 * Where to label `ground`: its tile nearest the middle of its tiles, so the label sits on the
 * ground whatever its shape. Ties go to the later tile: a rectangle's is (x + ⌊w ÷ 2⌋, y + ⌊h ÷ 2⌋).
 */
export function groundMiddle(state: GameState, ground: HuntingGroundComponent): Tile {
  const tiles = groundTiles(state, ground);
  const n = tiles.length;
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  // Distances scaled by n, so the middle (sx ÷ n, sy ÷ n) stays in whole numbers.
  let best = tiles[0] ?? { x: 0, y: 0 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const t of tiles) {
    const d = (t.x * n - sx) ** 2 + (t.y * n - sy) ** 2;
    if (d <= bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

/** The first Hunting ground in ID order that `tile` is on, or null. */
export function groundAt(state: GameState, tile: Tile): EntityId | null {
  const { huntingGround } = state.components;
  for (const id of idsOf(huntingGround)) {
    const g = huntingGround[id];
    if (g && inGround(state, g, tile)) return id;
  }
  return null;
}

/** Tiles of Hunting ground `groundId` within building `id`'s work radius, row-major. */
export function groundTilesInReach(
  state: GameState,
  content: Content,
  id: EntityId,
  groundId: EntityId,
): Tile[] {
  const ground = state.components.huntingGround[groundId];
  if (!ground) return [];
  return groundTiles(state, ground).filter((t) => inWorkRadius(state, content, id, t));
}

/**
 * Hunting grounds a `type` building at `origin` would reach: those with a tile within its work
 * radius (Chebyshev from the footprint; every ground for a building without one), in ID order.
 */
export function groundsNear(
  state: GameState,
  content: Content,
  type: BuildingId,
  origin: Tile,
  rotation: Rotation = 0,
): EntityId[] {
  const def = content.buildings[type];
  const { size } = buildingLayout(def, origin, rotation);
  const r = def.workRadius ?? Number.POSITIVE_INFINITY;
  const reaches = (t: Tile) =>
    Math.max(
      0,
      origin.x - t.x,
      t.x - (origin.x + size.w - 1),
      origin.y - t.y,
      t.y - (origin.y + size.h - 1),
    ) <= r;
  return idsOf(state.components.huntingGround).filter((g) => {
    const ground = state.components.huntingGround[g];
    return ground !== undefined && groundTiles(state, ground).some(reaches);
  });
}

/** Hunting grounds overlapping building `id`'s work radius, in ID order. */
export function groundsInReach(state: GameState, content: Content, id: EntityId): EntityId[] {
  const b = state.components.building[id];
  const origin = state.components.tile[id];
  return b && origin ? groundsNear(state, content, b.type, origin, b.rotation) : [];
}

/** Forest map objects (content `hunting.forest`) standing on `ground`'s tiles. */
export function standingTrees(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): number {
  const { mapObject, tile } = state.components;
  let count = 0;
  for (const id of idsOf(mapObject)) {
    const at = tile[id];
    if (mapObject[id]?.type === content.hunting.forest && at && inGround(state, ground, at)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Most Game `ground` holds with the forest standing now: `trunc(max × standing ÷ start)`, never
 * above its max Game (a forester can plant more trees than the ground started with).
 */
export function groundCeiling(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): number {
  if (ground.startTrees === 0) return ground.maxGame;
  const standing = standingTrees(state, content, ground);
  return Math.min(ground.maxGame, Math.trunc((ground.maxGame * standing) / ground.startTrees));
}

/** Chance a hunt in `ground` catches something, in permille: max chance × Game ÷ max Game. */
export function huntChancePermille(ground: HuntingGroundComponent, content: Content): number {
  if (ground.maxGame === 0) return 0;
  return Math.trunc((content.hunting.maxCatchPermille * ground.game) / ground.maxGame);
}

export function groundHealth(ground: HuntingGroundComponent, content: Content): GroundHealth {
  const { thrivingPercent, scarcePercent } = content.hunting;
  if (ground.game <= 0) return 'empty';
  if (ground.game * 100 >= thrivingPercent * ground.maxGame) return 'thriving';
  if (ground.game * 100 < scarcePercent * ground.maxGame) return 'scarce';
  return 'thinning';
}

/**
 * The day Game returns to a ground emptied on day `day`: the first day of the season after
 * `emptySeasons` full seasons (the season it was emptied in doesn't count).
 */
function emptyUntil(day: number, content: Content): number {
  const { daysPerSeason } = content.calendar;
  const season = Math.floor((day - 1) / daysPerSeason);
  return (season + content.hunting.emptySeasons + 1) * daysPerSeason + 1;
}

/**
 * Takes `n` animals from `ground` (a catch, or Game fleeing). Emptied, it stays empty until
 * `emptyUntil`; still holding some, its recovery clock starts if it wasn't running.
 */
export function loseGame(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
  n: number,
): void {
  if (n <= 0) return;
  const { day } = calendarAt(state.tick, content);
  ground.game = Math.max(0, ground.game - n);
  if (ground.game === 0) ground.regrowsOn = emptyUntil(day, content);
  else ground.regrowsOn ??= day + content.hunting.recoveryDays;
}

/**
 * At a Dawn: `ground`'s Game comes back if due. Empty, it gets `returningGame` animals on its day
 * (at most its ceiling; with a ceiling of 0 it stays empty another spell); under its ceiling, one
 * animal every `recoveryDays` days. At or over the ceiling nothing is due.
 */
export function regrowGame(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): void {
  const { day } = calendarAt(state.tick, content);
  const ceiling = groundCeiling(state, content, ground);
  if (ground.game === 0) {
    if (ground.regrowsOn !== null && day < ground.regrowsOn) return;
    // Due, or never timed (a ground that started with no Game): the animals come back, if any fit.
    ground.game = ground.regrowsOn === null ? 0 : Math.min(content.hunting.returningGame, ceiling);
    if (ground.game === 0) {
      ground.regrowsOn = emptyUntil(day, content);
      return;
    }
    ground.regrowsOn = null;
  } else if (ground.regrowsOn !== null && day >= ground.regrowsOn && ground.game < ceiling) {
    ground.game += 1;
    ground.regrowsOn = null;
  }
  if (ground.game < ceiling) ground.regrowsOn ??= day + content.hunting.recoveryDays;
  else ground.regrowsOn = null;
}

/** What the panel says about a ground's Game coming back, if anything. */
export type GroundRegrowth =
  /** Hunted empty: `days` until Game returns, or null while no Game would fit (no trees left). */
  | { kind: 'empty'; days: number | null }
  /** Under its ceiling, gaining Game. */
  | { kind: 'recovering' };

export function groundRegrowth(
  state: GameState,
  content: Content,
  ground: HuntingGroundComponent,
): GroundRegrowth | null {
  const ceiling = groundCeiling(state, content, ground);
  if (ground.game === 0) {
    const { day } = calendarAt(state.tick, content);
    const on = ground.regrowsOn;
    return { kind: 'empty', days: ceiling === 0 || on === null ? null : Math.max(0, on - day) };
  }
  return ground.game < ceiling ? { kind: 'recovering' } : null;
}

/**
 * Fells tree `id`: it becomes a Stump (same ID), which will sprout a Sapling. Forage patches it
 * shaded may wither. In every Hunting ground it stood on, Game above the new ceiling flees at once
 * and is counted in the ground's `fled`.
 */
export function fellTree(state: GameState, content: Content, id: EntityId): void {
  const at = state.components.tile[id];
  if (!at) return;
  leaveStump(state, content, id);
  refreshShade(state, content, at);
  for (const groundId of idsOf(state.components.huntingGround)) {
    const ground = state.components.huntingGround[groundId];
    if (!ground || !inGround(state, ground, at)) continue;
    const ceiling = groundCeiling(state, content, ground);
    if (ground.game <= ceiling) continue;
    ground.fled += ground.game - ceiling;
    loseGame(state, content, ground, ground.game - ceiling);
  }
}
