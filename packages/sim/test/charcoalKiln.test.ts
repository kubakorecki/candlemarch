// The charcoal kiln (spec, Resources: refined goods, tier 1): a workshop with no master that burns
// logs into charcoal, through the recipe system like the chopping block.
import { describe, expect, it } from 'vitest';
import { createInitialState, type MapDef } from '../src/map';
import type { GameState } from '../src/state';
import { amountOnTile } from '../src/stockpiles';
import { content, runUntil } from './helpers';

/**
 * A charcoal kiln at (1,1) (ID 1: door (1,2), yard (2,1)) and its charcoal burner 2, a 2×2
 * Stockpile at (6,1) (ID 3) with 12 logs, and a Carrier (ID 4) to bring them and take the charcoal.
 */
const kilnYard: MapDef = {
  name: 'kilnYard',
  rows: Array(6).fill('..........'),
  buildings: [{ type: 'charcoal_kiln', x: 1, y: 1 }],
  stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods: [{ resource: 'logs', amount: 12 }] }],
  villagers: [{ job: 'carrier', x: 4, y: 4 }],
};
const KILN = 1;
const STOCKPILE = 3;

/** Units of `resource` on the Stockpile. */
function piled(s: GameState, resource: 'logs' | 'charcoal'): number {
  const pile = s.components.stockpile[STOCKPILE];
  if (!pile) return 0;
  return Object.keys(pile.goods).reduce((n, i) => n + amountOnTile(pile, Number(i), resource), 0);
}

describe('the charcoal kiln', () => {
  it('is a Hamlet workshop with no master, burning logs into charcoal', () => {
    const def = content.buildings.charcoal_kiln;
    expect(def.recipes).toEqual(['burn_charcoal']);
    expect(content.recipes.burn_charcoal.inputs.map((i) => i.resource)).toEqual(['logs']);
    expect(content.recipes.burn_charcoal.outputs.map((o) => o.resource)).toEqual(['charcoal']);
    expect(content.ranks.find((r) => r.id === 'hamlet')?.unlocks.buildings).toContain(
      'charcoal_kiln',
    );
  });

  it('turns logs delivered to it into charcoal, which goes to the Stockpile', () => {
    const s0 = createInitialState(1, kilnYard, content);
    const { inputs, outputs } = content.recipes.burn_charcoal;
    const logsPerBatch = inputs[0]?.amount ?? 0;
    const charcoalPerBatch = outputs[0]?.amount ?? 0;
    const batches = 12 / logsPerBatch;
    const s = runUntil(s0, (x) => piled(x, 'charcoal') === batches * charcoalPerBatch, 20_000);
    expect(piled(s, 'charcoal')).toBe(batches * charcoalPerBatch);
    expect(piled(s, 'logs')).toBe(0);
    const kiln = s.components.building[KILN];
    expect(kiln?.input.logs ?? 0).toBe(0);
  });
});
