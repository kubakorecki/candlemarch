// The trade post and Merchants (spec, Economy: The trade post in M5). The trade post (one a
// village) keeps goods for sale in its Storage (`building.input`, what Carriers bring). A sell rule
// per good, "keep N in the village, sell the rest", makes the surplus a demand Carriers fill
// (`logistics/supplyDemand.ts`). A Merchant arrives at the Dawn of every few days outside winter,
// buys everything in the Storage at the current prices into the Treasury, unloads the Imports
// ordered since into `building.stock` (what Carriers take away, like a yard), and leaves at the
// next Dawn, when the next Merchant's Wanted list is drawn (`systems/merchants.ts`). Each unit
// sold lowers its good's price; prices climb back each Dawn. What's stored is `state.tradePost`;
// goods for sale aren't part of what "the village holds", Imports that arrived are.
import type { Content, CropId, ResourceId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { isKnownCrop } from './fields';
import { villageStock } from './standingOrders';
import type { EntityId, GameState } from './state';
import { spendCoin } from './treasury';

/** The most a sell rule may keep. */
export const MAX_SELL_KEEP = 999;

/** Whether building `id` is a trade post. */
export function isTradePost(state: GameState, content: Content, id: EntityId): boolean {
  const b = state.components.building[id];
  return b !== undefined && content.buildings[b.type].tradePost !== undefined;
}

/** The finished trade post, or null while none stands. */
export function tradePostOf(state: GameState, content: Content): EntityId | null {
  for (const id of idsOf(state.components.building)) {
    if (isTradePost(state, content, id)) return id;
  }
  return null;
}

/** Units of goods for sale in trade post `id`'s Storage, all goods together (0 for any other). */
export function forSaleIn(state: GameState, content: Content, id: EntityId): number {
  const b = state.components.building[id];
  if (!b || !isTradePost(state, content, id)) return 0;
  let total = 0;
  for (const resource of Object.keys(content.resources) as ResourceId[]) {
    total += b.input[resource] ?? 0;
  }
  return total;
}

/** Room left in trade post `id`'s Storage (0 for any other building). */
export function tradePostRoom(state: GameState, content: Content, id: EntityId): number {
  const b = state.components.building[id];
  const def = b && content.buildings[b.type].tradePost;
  if (!def) return 0;
  return Math.max(0, def.capacity - forSaleIn(state, content, id));
}

/**
 * Units of `resource` over what its sell rule keeps in the village (`villageStock`, which leaves
 * out goods already for sale): what Carriers bring to the trade post. 0 without a rule.
 */
export function sellSurplus(state: GameState, content: Content, resource: ResourceId): number {
  const keep = state.tradePost.keep[resource];
  if (keep === undefined) return 0;
  return Math.max(0, villageStock(state, content, resource) - keep);
}

/**
 * Sets the sell rule for `resource` (the `setSellRule` command): keep `keep` in the village and
 * sell the rest, or with null sell none. Ignored unless `keep` is a whole number from 0 to
 * `MAX_SELL_KEEP`. Rules are kept in content order.
 */
export function setSellRule(
  state: GameState,
  content: Content,
  resource: ResourceId,
  keep: number | null,
): void {
  if (!(resource in content.resources)) return;
  const rules = state.tradePost.keep;
  if (keep === null) {
    delete rules[resource];
    return;
  }
  if (!Number.isInteger(keep) || keep < 0 || keep > MAX_SELL_KEEP) return;
  rules[resource] = keep;
  const ordered: Partial<Record<ResourceId, number>> = {};
  for (const id of Object.keys(content.resources) as ResourceId[]) {
    if (rules[id] !== undefined) ordered[id] = rules[id];
  }
  state.tradePost.keep = ordered;
}

/** What a unit of `resource` fetches now, in hundredths of a coin, before any Wanted bonus. */
export function priceOf(state: GameState, content: Content, resource: ResourceId): number {
  return state.tradePost.prices[resource] ?? content.resources[resource].price.base;
}

/** The lowest `resource`'s price falls to. */
export function floorPrice(content: Content, resource: ResourceId): number {
  return Math.floor(
    (content.resources[resource].price.base * content.merchants.floorPercent) / 100,
  );
}

/** What the next unit of `resource` sold pays, in hundredths of a coin, Wanted bonus included. */
export function merchantPays(state: GameState, content: Content, resource: ResourceId): number {
  const price = priceOf(state, content, resource);
  if (!state.tradePost.wanted?.includes(resource)) return price;
  return Math.floor((price * (100 + content.merchants.wantedBonusPercent)) / 100);
}

/** Whether a Merchant comes on day `day` (counting from 1): every `everyDays`th, not in winter. */
export function isMerchantDay(content: Content, day: number): boolean {
  const { everyDays, closedSeasons } = content.merchants;
  if (day % everyDays !== 0) return false;
  const season = calendarAt((day - 1) * content.calendar.dayTicks, content).season;
  return !closedSeasons.includes(season);
}

/**
 * The day the next Merchant arrives, after today, or today's while one is here. Comes whether a
 * trade post stands or not; one that doesn't stand at that Dawn gets no visit.
 */
export function nextMerchantDay(state: GameState, content: Content): number {
  const today = calendarAt(state.tick, content).day;
  if (state.tradePost.merchantHere) return today;
  let day = today + 1;
  while (!isMerchantDay(content, day)) day += 1;
  return day;
}

/** What `amount` units of `resource` cost as an Import, in hundredths of a coin. */
export function importCost(content: Content, resource: ResourceId, amount: number): number {
  const unit = Math.floor(
    (content.resources[resource].price.base * content.merchants.importPricePercent) / 100,
  );
  return unit * amount;
}

/**
 * Orders `amount` units of `resource` from the next Merchant (the `orderImport` command), paid out
 * of the Treasury at once. Ignored unless a trade post stands, the good is in the catalogue
 * (`merchants.imports`), `amount` is a positive whole number and the Treasury covers it.
 */
export function orderImport(
  state: GameState,
  content: Content,
  resource: ResourceId,
  amount: number,
): void {
  if (!content.merchants.imports.includes(resource)) return;
  if (!Number.isInteger(amount) || amount <= 0) return;
  if (tradePostOf(state, content) === null) return;
  const cost = importCost(content, resource, amount);
  if (state.treasury < cost) return;
  state.treasury -= cost;
  const { orders } = state.tradePost;
  orders[resource] = (orders[resource] ?? 0) + amount;
}

/**
 * Whether `crop`'s Seeds may be ordered now, the Treasury aside: it needs Seeds, isn't known yet
 * (`isKnownCrop`) and isn't ordered already.
 */
export function seedsOrderable(state: GameState, content: Content, crop: CropId): boolean {
  const def = content.crops[crop];
  return (
    def !== undefined &&
    def.seeds !== null &&
    !isKnownCrop(state, content, crop) &&
    !state.tradePost.seedOrders.includes(crop)
  );
}

/**
 * Orders `crop`'s Seeds from the next Merchant (the `orderSeeds` command), paid out of the
 * Treasury at once (`CropDef.seeds`, whole coins). Ignored unless a trade post stands, they're
 * `seedsOrderable` and the Treasury covers them. Seeds aren't goods: the Merchant's arrival makes
 * the Crop known (`systems/merchants.ts`).
 */
export function orderSeeds(state: GameState, content: Content, crop: CropId): void {
  if (!seedsOrderable(state, content, crop) || tradePostOf(state, content) === null) return;
  if (!spendCoin(state, content.crops[crop].seeds ?? 0)) return;
  const ordered = [...state.tradePost.seedOrders, crop];
  state.tradePost.seedOrders = (Object.keys(content.crops) as CropId[]).filter((c) =>
    ordered.includes(c),
  );
}
