import { describe, expect, it } from 'vitest';
import {
  badgeTone,
  bandText,
  neighboursText,
  signedText,
  sourceText,
} from '../src/game/happinessText';

describe('happiness text', () => {
  it('names the bands', () => {
    expect(bandText('happy')).toBe('Happy');
    expect(bandText('content')).toBe('Content');
    expect(bandText('unhappy')).toBe('Unhappy');
  });

  it('signs values with a true minus', () => {
    expect(signedText(10)).toBe('+10');
    expect(signedText(-30)).toBe('−30');
    expect(signedText(0)).toBe('0');
  });

  it('words each source', () => {
    expect(sourceText({ kind: 'homeless', value: -30 })).toEqual({
      label: 'Homeless',
      value: '−30',
    });
    expect(sourceText({ kind: 'deaths', deaths: 1, value: -10 })).toEqual({
      label: '1 death in 3 days',
      value: '−10',
    });
    expect(sourceText({ kind: 'deaths', deaths: 2, value: -20 }).label).toBe('2 deaths in 3 days');
    expect(sourceText({ kind: 'woods', value: 10 })).toEqual({ label: 'Near woods', value: '+10' });
    expect(sourceText({ kind: 'poi', poi: 'shrine', value: 10 }).label).toBe('Near the Shrine');
    expect(sourceText({ kind: 'building', building: 'smokehouse', value: -10 }).label).toBe(
      'Near the Smokehouse',
    );
  });

  it("words a House's neighbours for its placement", () => {
    expect(
      neighboursText(
        [
          { kind: 'woods', value: 10 },
          { kind: 'building', building: 'smokehouse', value: -10 },
        ],
        0,
      ),
    ).toBe('Its neighbours add 0: woods +10, the Smokehouse −10.');
    expect(neighboursText([], 0)).toBeNull();
  });

  it('tones a badge by its change', () => {
    expect(badgeTone(10)).toBe('liked');
    expect(badgeTone(-10)).toBe('disliked');
    expect(badgeTone(0)).toBe('none');
  });
});
