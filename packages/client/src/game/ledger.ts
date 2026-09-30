// What the Ledger (the stores bar) counts. Pure.
import type { Content, ResourceId } from '@candlemarch/content';
import { type GameState, isStockpileGood } from '@candlemarch/sim';

/** Goods on every Stockpile, by resource; resources with none are left out. */
export function stockpileGoods(state: GameState): Partial<Record<ResourceId, number>> {
  const totals: Partial<Record<ResourceId, number>> = {};
  for (const pile of Object.values(state.components.stockpile)) {
    for (const goods of Object.values(pile.goods)) {
      totals[goods.resource] = (totals[goods.resource] ?? 0) + goods.amount;
    }
  }
  return totals;
}

/**
 * The Stockpile goods the Ledger shows, in content order: those some building makes (an output
 * buffer holds them), and any other the village has on its Stockpiles (`goods`). Goods nothing
 * makes yet, such as stone before M5's quarry, stay off it while there are none.
 */
export function ledgerGoods(
  content: Content,
  goods: Partial<Record<ResourceId, number>>,
): ResourceId[] {
  const made = new Set(
    Object.values(content.buildings).flatMap((b) => (b.outputBuffer ?? []).map((s) => s.resource)),
  );
  return (Object.keys(content.resources) as ResourceId[]).filter(
    (r) => isStockpileGood(content, r) && (made.has(r) || (goods[r] ?? 0) > 0),
  );
}
