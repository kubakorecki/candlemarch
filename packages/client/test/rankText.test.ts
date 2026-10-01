import { describe, expect, it } from 'vitest';
import { lockCardText, lockText, rankText } from '../src/game/rankText';

const toHamlet = { rank: 'hamlet', building: 'village_hall', needed: 10 } as const;

describe('rank text', () => {
  it('names the rank and the next step toward the next one', () => {
    expect(
      rankText({ rank: 'camp', next: { ...toHamlet, residents: 7, underway: false } }),
    ).toEqual({ rank: 'Camp', next: 'Toward Hamlet: 7/10 residents' });
    expect(
      rankText({ rank: 'camp', next: { ...toHamlet, residents: 10, underway: false } }).next,
    ).toBe('Toward Hamlet: build a Village hall');
    expect(
      rankText({ rank: 'camp', next: { ...toHamlet, residents: 11, underway: true } }).next,
    ).toBe('Toward Hamlet: the Village hall is being built');
  });

  it('has no next step without a next rank to reach', () => {
    expect(rankText({ rank: 'hamlet', next: null })).toEqual({ rank: 'Hamlet', next: null });
  });

  it('says what a locked building waits for', () => {
    expect(lockText({ kind: 'residents', residents: 7, needed: 10 })).toBe(
      'Needs 10 residents: 7/10.',
    );
    expect(lockCardText({ kind: 'residents', residents: 7, needed: 10 })).toBe('7/10 residents');
    expect(lockText({ kind: 'rank', rank: 'hamlet' })).toBe('Unlocked at Hamlet.');
    expect(lockCardText({ kind: 'rank', rank: 'hamlet' })).toBe('Hamlet');
  });
});
