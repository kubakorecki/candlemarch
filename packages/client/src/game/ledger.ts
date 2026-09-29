// What the Ledger (the stores bar) counts. Pure.
import type { ResourceId } from '@candlemarch/content';
import type { GameState } from '@candlemarch/sim';

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
