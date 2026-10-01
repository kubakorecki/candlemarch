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
      title: 'Charter',
      conditions: [
        { text: 'A free place in a House', met: true },
        { text: 'A mine or bog-iron digger', met: false },
      ],
      coin: 'Fee 300 coin',
      ends: 'Withdrawn in 6 days',
      canAccept: false,
    });
    expect(postingView(charter, 9 * DAY + 1).ends).toBe('Withdrawn in 1 day');
  });

  it('words a Delivery order: its reward and when it falls due', () => {
    const order: Posting = { ...charter, kind: 'delivery', conditions: [], canAccept: true };
    expect(postingView(order, 0)).toMatchObject({
      title: 'Delivery order',
      coin: 'Reward 300 coin',
      ends: 'Due in 10 days',
      canAccept: true,
    });
  });
});
