import type { Posting } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import { conditionText, postingView } from '../src/game/postingText';

const DAY = 3600;

const charter: Posting = {
  id: 7,
  kind: 'charter',
  conditions: [
    { kind: 'housePlace', met: true },
    { kind: 'building', anyOf: ['mine', 'bog_iron_digger'], met: false },
  ],
  coin: 300,
  endsAt: 10 * DAY,
  canAccept: false,
  coinShort: false,
  accepted: false,
  goods: null,
  master: { name: 'Brenna', trade: 'smith' },
};

describe('posting text', () => {
  it('words each condition', () => {
    expect(conditionText({ kind: 'housePlace', met: false })).toBe('A free place in a House');
    expect(conditionText({ kind: 'building', anyOf: ['quarry'], met: true })).toBe('A quarry');
    expect(
      conditionText({ kind: 'building', anyOf: ['hunters_lodge', 'fishers_hut'], met: true }),
    ).toBe("A hunter's lodge or fisher's hut");
  });

  it('words a Charter: its conditions met or not, its fee, the days until it is withdrawn', () => {
    expect(postingView(charter, 4 * DAY + 100)).toEqual({
      id: 7,
      title: 'Brenna the Smith',
      conditions: [
        { text: 'A free place in a House', met: true },
        { text: 'A mine or bog-iron digger', met: false },
      ],
      coin: 'Fee 300 coin',
      ends: 'Withdrawn in 6 days',
      canAccept: false,
      accepted: false,
      goods: null,
    });
    expect(postingView(charter, 9 * DAY + 1).ends).toBe('Withdrawn in 1 day');
  });

  it("says when the Treasury can't cover a Charter's fee", () => {
    expect(postingView({ ...charter, coinShort: true }, 0).coin).toBe(
      'Fee 300 coin: the Treasury is short',
    );
  });

  it('words a Delivery order: its goods, its reward and when it falls due', () => {
    const order: Posting = {
      ...charter,
      kind: 'delivery',
      master: null,
      conditions: [],
      canAccept: true,
      goods: { resource: 'smoked_fish', amount: 30, delivered: 0 },
    };
    expect(postingView(order, 0)).toMatchObject({
      title: 'Delivery order',
      goods: 'Smoked fish 0 / 30 to the trade post',
      coin: 'Reward 300 coin',
      ends: 'Due in 10 days',
      canAccept: true,
      accepted: false,
    });
    const underway = { ...order, canAccept: false, accepted: true };
    const view = postingView(
      { ...underway, goods: { resource: 'smoked_fish', amount: 30, delivered: 12 } },
      0,
    );
    expect(view).toMatchObject({ goods: 'Smoked fish 12 / 30 to the trade post', accepted: true });
  });
});
