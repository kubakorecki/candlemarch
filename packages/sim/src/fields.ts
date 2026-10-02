// Fields and farms (spec, Resources: Farms and crops). Fields are open tiles of `farming.fieldOn`
// terrain (Meadow) the player paints in a farm's work radius, free and at once, Revealed tiles
// only; painted ground nothing stands on, so a building, Road, Stockpile or wall put there
// takes it (`clearGrowth`). Kept as `map.fields` by tile index, a static layer. Every farm works
// the Fields in its radius, whoever painted them; its Crop is the farm's (`farmCrop`), one the
// village knows (`isKnownCrop`: grain, or one whose Seeds were bought). The year:
// farmers sow bare Fields in the sowing season (spring), a Field is ripe `growDays` later at a
// Dawn, they harvest it once, and whatever stands at the first Dawn of the idle season (winter) is
// lost (`systems/fields.ts`). Each spring some Fields throw up a Fieldstone (`throwUpFieldstones`),
// cleared before sowing; it leaves through the farm's yard as stone.
import type { Content, CropId, ResourceAmount, ResourceId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { isRevealed } from './fog';
import { isOpenGround } from './forest';
import { inWorkRadius } from './gathering';
import { inBounds, tileAt, tileIndex } from './grid';
import { reserveRect } from './reserves';
import { randomInt } from './rng';
import { staticChanged } from './snapshot';
import { isPaused } from './standingOrders';
import type { EntityId, FieldTile, FieldWork, GameState, Tile } from './state';
import { fitsInYard } from './yards';

/** The Field on `tile`, or undefined. */
export function fieldAt(state: GameState, tile: Tile): FieldTile | undefined {
  const { map } = state;
  if (!inBounds(map, tile.x, tile.y)) return undefined;
  return map.fields[tileIndex(map, tile.x, tile.y)];
}

/** Whether building `id` is a farm. */
export function isFarm(state: GameState, content: Content, id: EntityId): boolean {
  const b = state.components.building[id];
  return b !== undefined && content.buildings[b.type].farm === true;
}

/**
 * Whether `tile` may be painted as a Field of farm `farm`: in its work radius, Revealed, of the
 * Field terrain, with nothing standing on it, and not a Field already.
 */
export function canBeField(
  state: GameState,
  content: Content,
  farm: EntityId,
  tile: Tile,
): boolean {
  const { map } = state;
  if (!isFarm(state, content, farm) || !inBounds(map, tile.x, tile.y)) return false;
  const i = tileIndex(map, tile.x, tile.y);
  return (
    map.fields[i] === undefined &&
    map.terrain[i] === content.farming.fieldOn &&
    isRevealed(state, tile) &&
    isOpenGround(state, content, tile) &&
    inWorkRadius(state, content, farm, tile)
  );
}

/**
 * Paints the tiles of the rectangle with corners `from` and `to` that may be Fields of farm `farm`
 * (`canBeField`) as bare Fields, skipping the rest (the `paintFields` command).
 */
export function paintFields(
  state: GameState,
  content: Content,
  farm: EntityId,
  from: Tile,
  to: Tile,
): void {
  if (!inBounds(state.map, from.x, from.y) || !inBounds(state.map, to.x, to.y)) return;
  let painted = false;
  for (const t of reserveRect(from, to)) {
    if (!canBeField(state, content, farm, t)) continue;
    state.map.fields[tileIndex(state.map, t.x, t.y)] = {
      stage: 'bare',
      crop: null,
      ripensAt: null,
      stone: false,
    };
    painted = true;
  }
  if (painted) staticChanged(state);
}

/**
 * Erases every Field in the rectangle with corners `from` and `to`, with whatever grows on it (the
 * `eraseFields` command). Ignores Fog.
 */
export function eraseFields(state: GameState, from: Tile, to: Tile): void {
  const { map } = state;
  if (!inBounds(map, from.x, from.y) || !inBounds(map, to.x, to.y)) return;
  let erased = false;
  for (const t of reserveRect(from, to)) {
    const i = tileIndex(map, t.x, t.y);
    if (map.fields[i] === undefined) continue;
    delete map.fields[i];
    erased = true;
  }
  if (erased) staticChanged(state);
}

/** Farm `id`'s Crop this year: what its farmers sow. */
export function farmCrop(state: GameState, content: Content, id: EntityId): CropId {
  return state.components.building[id]?.crop ?? content.farming.defaultCrop;
}

/** The Crop picked in farm `id`'s panel: sown from the next sowing season on. */
export function farmNextCrop(state: GameState, content: Content, id: EntityId): CropId {
  return state.components.building[id]?.nextCrop ?? farmCrop(state, content, id);
}

/** Whether every farm may grow `crop`: it needs no Seeds, or a Merchant has brought them. */
export function isKnownCrop(state: GameState, content: Content, crop: CropId): boolean {
  const def = content.crops[crop];
  return def !== undefined && (def.seeds === null || state.seeds.includes(crop));
}

/** The Crops every farm may grow (`isKnownCrop`), in content order. */
export function knownCrops(state: GameState, content: Content): CropId[] {
  return (Object.keys(content.crops) as CropId[]).filter((c) => isKnownCrop(state, content, c));
}

/**
 * Picks the Crop farm `building` grows from the next sowing season on (the `setCrop` command).
 * Ignored unless it's a farm and `crop` is a known Crop (`isKnownCrop`).
 */
export function setCrop(
  state: GameState,
  content: Content,
  building: EntityId,
  crop: CropId,
): void {
  const b = state.components.building[building];
  if (!b || !isFarm(state, content, building) || !isKnownCrop(state, content, crop)) return;
  b.nextCrop = crop;
}

/** At the start of the sowing season: every farm's picked Crop becomes this year's. */
export function startSowingYear(state: GameState): void {
  for (const b of Object.values(state.components.building)) {
    if (b.nextCrop === undefined) continue;
    b.crop = b.nextCrop;
    delete b.nextCrop;
  }
}

/**
 * The Fields in farm `id`'s work radius, row-major: every one it works, whoever painted it. Fields
 * something has come to stand on since (a Den, a cache) are left out.
 */
export function farmFields(state: GameState, content: Content, id: EntityId): Tile[] {
  if (!isFarm(state, content, id)) return [];
  const tiles: Tile[] = [];
  for (const key in state.map.fields) {
    const t = tileAt(state.map, Number(key));
    if (inWorkRadius(state, content, id, t) && isOpenGround(state, content, t)) tiles.push(t);
  }
  return tiles;
}

/**
 * What farm `farm`'s farmers could do on `tile` now, yard room aside: clear its Fieldstone, harvest
 * it once ripe, or in the sowing season sow it while bare, unless the farm is paused by its
 * standing order. Nothing in the idle season (winter), nor off its Fields.
 */
export function fieldWork(
  state: GameState,
  content: Content,
  farm: EntityId,
  tile: Tile,
): FieldWork | null {
  const field = fieldAt(state, tile);
  if (!field || !isFarm(state, content, farm)) return null;
  const { season } = calendarAt(state.tick, content);
  const { farming } = content;
  if (season === farming.idleSeason) return null;
  if (field.stone) return 'clear';
  if (field.stage === 'ripe') return 'harvest';
  if (field.stage === 'bare' && season === farming.sowSeason && !isPaused(state, content, farm)) {
    return 'sow';
  }
  return null;
}

/** What doing `work` on `field` gives to carry to the yard: a harvest, a Fieldstone, or nothing. */
export function workGives(
  content: Content,
  field: FieldTile,
  work: FieldWork,
): ResourceAmount | null {
  if (work === 'clear') return content.farming.fieldstone;
  if (work === 'harvest' && field.crop !== null) {
    const crop = content.crops[field.crop];
    return { resource: crop.resource, amount: crop.yieldPerField };
  }
  return null;
}

/** A Field with work for a farm's farmers. */
export interface FieldJob {
  field: Tile;
  work: FieldWork;
}

/** Every Field in farm `id`'s radius with work to do now (`fieldWork`), row-major, yard room aside. */
function waitingWork(state: GameState, content: Content, id: EntityId): FieldJob[] {
  const jobs: FieldJob[] = [];
  for (const field of farmFields(state, content, id)) {
    const work = fieldWork(state, content, id, field);
    if (work !== null) jobs.push({ field, work });
  }
  return jobs;
}

/** Whether what doing `job` gives fits farm `id`'s yard whole. */
function fits(state: GameState, content: Content, id: EntityId, job: FieldJob): boolean {
  const field = fieldAt(state, job.field);
  const gives = field ? workGives(content, field, job.work) : null;
  return gives === null || fitsInYard(state, content, id, [gives]);
}

/** The Field work farm `id`'s farmers can do now: `fieldWork`, with yard room for what it gives. */
export function farmWork(state: GameState, content: Content, id: EntityId): FieldJob[] {
  return waitingWork(state, content, id).filter((job) => fits(state, content, id, job));
}

/**
 * What farm `id`'s yard has no room for, when that stops its farmers: what its waiting Field work
 * gives, when none of that work can be done. Empty while some can, or none waits.
 */
export function farmNoRoom(state: GameState, content: Content, id: EntityId): ResourceId[] {
  const waiting = waitingWork(state, content, id);
  if (waiting.length === 0 || waiting.some((job) => fits(state, content, id, job))) return [];
  const resources: ResourceId[] = [];
  for (const job of waiting) {
    const field = fieldAt(state, job.field);
    const gives = field ? workGives(content, field, job.work) : null;
    if (gives && !resources.includes(gives.resource)) resources.push(gives.resource);
  }
  return resources;
}

/**
 * Spring (`systems/renewal.ts`): each Field without a Fieldstone throws one up with the content's
 * chance, rolled with the PRNG in tile-index order.
 */
export function throwUpFieldstones(state: GameState, content: Content): void {
  const { fields } = state.map;
  let thrown = false;
  for (const key in fields) {
    const field = fields[Number(key)] as FieldTile;
    if (field.stone) continue;
    if (randomInt(state, 100) >= content.farming.fieldstonePercent) continue;
    field.stone = true;
    thrown = true;
  }
  if (thrown) staticChanged(state);
}
