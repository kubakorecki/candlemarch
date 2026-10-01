// The tier-1 master workshops (spec, Resources: refined goods, tier 1): the sawpit, stonecutter,
// brick kiln and smokehouse run on the recipe system once their trade's Master has settled.
import type { ResourceId, TradeId } from '@candlemarch/content';
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

/** Units of `resource` in every building's `stock` (a Granary's Food, a yard's goods). */
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

/**
 * `workshop` at (1,1) with its worker, a 2×2 Stockpile at (6,1) holding `goods`, and a Carrier at
 * (4,4), who becomes the `trade`'s Master: the workshop's own worker goes back to carrying.
 */
function chain(
  workshop: 'sawpit' | 'stonecutter' | 'brick_kiln',
  trade: TradeId,
  goods: { resource: ResourceId; amount: number }[],
): GameState {
  const map: MapDef = {
    name: workshop,
    rows: Array(7).fill('..........'),
    buildings: [{ type: workshop, x: 1, y: 1 }],
    stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods }],
    villagers: [{ job: 'carrier', x: 4, y: 4 }],
  };
  const s = createInitialState(1, map, content);
  settleMaster(s, carrier(s), trade);
  return s;
}

describe('the tier-1 master workshops', () => {
  it('are Hamlet buildings run by their trade', () => {
    const hamlet = content.ranks.find((r) => r.id === 'hamlet')?.unlocks.buildings;
    expect(hamlet).toEqual(expect.arrayContaining(['sawpit', 'stonecutter', 'brick_kiln']));
    expect(hamlet).toContain('smokehouse');
    expect(content.buildings.sawpit.trade).toBe('carpenter');
    expect(content.buildings.stonecutter.trade).toBe('mason');
    expect(content.buildings.brick_kiln.trade).toBe('mason');
    expect(content.buildings.smokehouse.trade).toBe('butcher');
  });

  it('stand idle until their Master settles', () => {
    const map: MapDef = {
      name: 'idle',
      rows: Array(7).fill('..........'),
      buildings: [{ type: 'sawpit', x: 1, y: 1 }],
      stockpiles: [{ x: 6, y: 1, w: 2, h: 2, goods: [{ resource: 'logs', amount: 4 }] }],
      villagers: [{ job: 'carrier', x: 4, y: 4 }],
    };
    const s = run(createInitialState(1, map, content), 600);
    expect(piled(s, 'logs')).toBe(4);
    expect(stocked(s, 'planks')).toBe(0);
  });

  it('the sawpit saws logs into planks', () => {
    const s = runUntil(
      chain('sawpit', 'carpenter', [{ resource: 'logs', amount: 4 }]),
      (x) => piled(x, 'planks') === 8,
      3000,
    );
    expect(piled(s, 'planks')).toBe(8);
    expect(piled(s, 'logs')).toBe(0);
  });

  it('the stonecutter cuts stone', () => {
    const s = runUntil(
      chain('stonecutter', 'mason', [{ resource: 'stone', amount: 4 }]),
      (x) => piled(x, 'cut_stone') === 4,
      3000,
    );
    expect(piled(s, 'cut_stone')).toBe(4);
    expect(piled(s, 'stone')).toBe(0);
  });

  it('the brick kiln fires clay with firewood into bricks', () => {
    const s = runUntil(
      chain('brick_kiln', 'mason', [
        { resource: 'clay', amount: 4 },
        { resource: 'firewood', amount: 2 },
      ]),
      (x) => piled(x, 'bricks') === 6,
      3000,
    );
    expect(piled(s, 'bricks')).toBe(6);
    expect(piled(s, 'clay')).toBe(0);
    expect(piled(s, 'firewood')).toBe(0);
  });

  it('the smokehouse smokes fish and meat with firewood into Food for the Granary', () => {
    // Smokehouse 1 at (1,1) and its smoker 2; a hunter's lodge 3 at (4,1) with 3 meat in its yard
    // and its hunter 4 (no ground to hunt); a Granary 5 at (1,4); a Stockpile with 2 firewood; a
    // Carrier, who becomes the Butcher. Fish goes straight into the smokehouse's input.
    const map: MapDef = {
      name: 'smokehouse',
      rows: Array(8).fill('..........'),
      buildings: [
        { type: 'smokehouse', x: 1, y: 1 },
        { type: 'hunters_lodge', x: 4, y: 1, stock: [{ resource: 'meat', amount: 3 }] },
        { type: 'granary', x: 1, y: 4 },
      ],
      stockpiles: [{ x: 7, y: 1, w: 2, h: 2, goods: [{ resource: 'firewood', amount: 2 }] }],
      villagers: [{ job: 'carrier', x: 5, y: 6 }],
    };
    const s0 = createInitialState(1, map, content);
    const smokehouse = s0.components.building[1];
    if (smokehouse) smokehouse.input.fish = 3;
    settleMaster(s0, carrier(s0), 'butcher');
    const granary = (x: GameState, r: ResourceId) => x.components.building[5]?.stock[r] ?? 0;
    const s = runUntil(
      s0,
      (x) => granary(x, 'smoked_fish') === 3 && granary(x, 'smoked_meat') === 3,
      3000,
    );
    expect(granary(s, 'smoked_fish')).toBe(3);
    expect(granary(s, 'smoked_meat')).toBe(3);
    expect(stocked(s, 'meat') + stocked(s, 'fish')).toBe(0);
    expect(piled(s, 'firewood')).toBe(0);
    // Smoked goods keep: 3% a day against fresh fish's 15% (spec, Spoilage).
    for (const id of ['smoked_fish', 'smoked_meat'] as const) {
      const def = content.resources[id];
      expect(def.storage === 'granary' ? def.spoilPercent : null).toBe(3);
    }
  });
});
