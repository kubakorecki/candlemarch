// The tier-2 workshops the Tavern needs (spec, Resources: refined goods, tier 2): the bloomery
// smelts iron ore with charcoal into iron bars and the brewery brews grain with firewood into ale,
// on the recipe system, once their trade's Master has settled.
import type { ResourceId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { createInitialState, type MapDef } from '../src/map';
import { settleMaster } from '../src/masters';
import type { EntityId, GameState } from '../src/state';
import { amountOnTile } from '../src/stockpiles';
import { content, run, runUntil } from './helpers';

/** Units of `resource` on every Stockpile. */
function piled(s: GameState, resource: ResourceId): number {
  let total = 0;
  for (const pile of Object.values(s.components.stockpile)) {
    for (const i of Object.keys(pile.goods)) total += amountOnTile(pile, Number(i), resource);
  }
  return total;
}

/** Units of `resource` in every building's `stock` (a yard's goods). */
function stocked(s: GameState, resource: ResourceId): number {
  return Object.values(s.components.building).reduce((n, b) => n + (b.stock[resource] ?? 0), 0);
}

/** The lowest-ID Carrier. */
function carrier(s: GameState): EntityId {
  const { villager } = s.components;
  const id = Object.keys(villager)
    .map(Number)
    .find((v) => villager[v]?.job === 'carrier');
  if (id === undefined) throw new Error('no Carrier');
  return id;
}

/** A bloomery at (1,1) with its worker, a Stockpile with 4 iron ore and 2 charcoal, a Carrier. */
const forge: MapDef = {
  name: 'forge',
  rows: Array(7).fill('..........'),
  buildings: [{ type: 'bloomery', x: 1, y: 1 }],
  stockpiles: [
    {
      x: 6,
      y: 1,
      w: 2,
      h: 2,
      goods: [
        { resource: 'iron_ore', amount: 4 },
        { resource: 'charcoal', amount: 2 },
      ],
    },
  ],
  villagers: [{ job: 'carrier', x: 4, y: 4 }],
};

describe('the bloomery and brewery', () => {
  it('are Hamlet buildings run by the Smith and the Brewer', () => {
    const hamlet = content.ranks.find((r) => r.id === 'hamlet')?.unlocks.buildings;
    expect(hamlet).toEqual(expect.arrayContaining(['bloomery', 'brewery']));
    expect(content.buildings.bloomery.trade).toBe('smith');
    expect(content.buildings.brewery.trade).toBe('brewer');
  });

  it('the bloomery stands idle until a Smith settles', () => {
    const s = run(createInitialState(1, forge, content), 600);
    expect(piled(s, 'iron_ore')).toBe(4);
    expect(stocked(s, 'iron_bars') + piled(s, 'iron_bars')).toBe(0);
  });

  it('the bloomery smelts iron ore with charcoal into iron bars', () => {
    // The Carrier becomes the Smith: the bloomery's own worker goes back to carrying.
    const s0 = createInitialState(1, forge, content);
    settleMaster(s0, carrier(s0), 'smith');
    const s = runUntil(s0, (x) => piled(x, 'iron_bars') === 2, 3000);
    expect(piled(s, 'iron_bars')).toBe(2);
    expect(piled(s, 'iron_ore')).toBe(0);
    expect(piled(s, 'charcoal')).toBe(0);
  });

  it("the brewery brews grain from a farm's yard with firewood into ale", () => {
    // Brewery 1 at (1,1) and its brewer 2; a farm 3 at (1,4) with 4 grain in its yard and its
    // farmers 4–5 (no Fields); a Stockpile with 2 firewood; a Carrier, who becomes the Brewer.
    const map: MapDef = {
      name: 'brewhouse',
      rows: Array(8).fill('..........'),
      buildings: [
        { type: 'brewery', x: 1, y: 1 },
        { type: 'farm', x: 1, y: 4, stock: [{ resource: 'grain', amount: 4 }] },
      ],
      stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods: [{ resource: 'firewood', amount: 2 }] }],
      villagers: [{ job: 'carrier', x: 5, y: 6 }],
    };
    const s0 = createInitialState(1, map, content);
    settleMaster(s0, carrier(s0), 'brewer');
    const s = runUntil(s0, (x) => piled(x, 'ale') === 4, 3000);
    expect(piled(s, 'ale')).toBe(4);
    expect(stocked(s, 'grain')).toBe(0);
    expect(piled(s, 'firewood')).toBe(0);
  });
});
