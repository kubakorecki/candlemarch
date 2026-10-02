// Merchants (spec, Economy: The trade post in M5): at each Dawn but the first, prices recover, a
// Merchant here leaves and the next one's Wanted list is drawn, and on a Merchant day one arrives
// and buys everything in the trade post's Storage into the Treasury, then unloads the Imports
// ordered and brings the Seeds ordered (`tradePost.ts`).
import type { Content, CropId, ResourceId } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { randomInt } from '../rng';
import type { EntityId, GameState } from '../state';
import { floorPrice, isMerchantDay, merchantPays, priceOf, tradePostOf } from '../tradePost';

/** A Wanted list: `wanted.min`–`wanted.max` goods drawn with the PRNG, in content order. */
function drawWanted(state: GameState, content: Content): ResourceId[] {
  const { min, max } = content.merchants.wanted;
  const all = Object.keys(content.resources) as ResourceId[];
  const pool = [...all];
  const count = Math.min(pool.length, min + randomInt(state, max - min + 1));
  const picked: ResourceId[] = [];
  for (let i = 0; i < count; i++) {
    const [good] = pool.splice(randomInt(state, pool.length), 1);
    if (good) picked.push(good);
  }
  return picked.sort((a, b) => all.indexOf(a) - all.indexOf(b));
}

/** Every price climbs back `recoverPercent` of its base, up to the base (where it's dropped). */
function recoverPrices(state: GameState, content: Content): void {
  const { prices } = state.tradePost;
  for (const resource of Object.keys(prices) as ResourceId[]) {
    const { base } = content.resources[resource].price;
    const price =
      (prices[resource] ?? base) + Math.floor((base * content.merchants.recoverPercent) / 100);
    if (price >= base) delete prices[resource];
    else prices[resource] = price;
  }
}

/** The Merchant buys everything in trade post `post`'s Storage, unit by unit, into the Treasury. */
function buyEverything(state: GameState, content: Content, post: EntityId): void {
  const b = state.components.building[post];
  if (!b) return;
  for (const resource of Object.keys(content.resources) as ResourceId[]) {
    const units = b.input[resource] ?? 0;
    const { dropPerUnit } = content.resources[resource].price;
    for (let i = 0; i < units; i++) {
      state.treasury += merchantPays(state, content, resource);
      const price = Math.max(
        floorPrice(content, resource),
        priceOf(state, content, resource) - dropPerUnit,
      );
      state.tradePost.prices[resource] = price;
    }
    delete b.input[resource];
  }
}

/** The Merchant unloads every Import ordered into trade post `post`, for Carriers to take. */
function unloadImports(state: GameState, content: Content, post: EntityId): void {
  const b = state.components.building[post];
  if (!b) return;
  const { orders } = state.tradePost;
  for (const resource of Object.keys(content.resources) as ResourceId[]) {
    const amount = orders[resource] ?? 0;
    if (amount > 0) b.stock[resource] = (b.stock[resource] ?? 0) + amount;
  }
  state.tradePost.orders = {};
}

/** The Merchant brings every Seeds ordered: their Crops are known for good, nothing is stored. */
function bringSeeds(state: GameState, content: Content): void {
  const known = [...state.seeds, ...state.tradePost.seedOrders];
  state.seeds = (Object.keys(content.crops) as CropId[]).filter((c) => known.includes(c));
  state.tradePost.seedOrders = [];
}

/**
 * At each Dawn but the first: prices recover; a Merchant here leaves, and while a trade post
 * stands the next one's Wanted list is drawn (or the first list, the first Dawn one stands); on a
 * Merchant day with a trade post standing, a Merchant arrives, buys everything in its Storage, then
 * unloads the Imports ordered (which it never buys back).
 */
export function merchantSystem(state: GameState, content: Content): void {
  if (state.tick === 0 || !isDawn(state.tick, content)) return;
  const trade = state.tradePost;
  recoverPrices(state, content);
  const post = tradePostOf(state, content);
  if (trade.merchantHere) {
    trade.merchantHere = false;
    if (post !== null) trade.wanted = drawWanted(state, content);
  }
  if (post === null) return;
  if (trade.wanted === null) trade.wanted = drawWanted(state, content);
  if (!isMerchantDay(content, calendarAt(state.tick, content).day)) return;
  buyEverything(state, content, post);
  unloadImports(state, content, post);
  bringSeeds(state, content);
  trade.merchantHere = true;
}
