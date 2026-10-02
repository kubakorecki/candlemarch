import { describe, expect, it } from 'vitest';
import { bandText, signedText, sourceText } from '../src/game/happinessText';

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
    expect(sourceText({ kind: 'homeless', value: -30 }, 3)).toEqual({
      label: 'Homeless',
      value: '−30',
    });
    expect(sourceText({ kind: 'deaths', deaths: 1, value: -10 }, 3)).toEqual({
      label: '1 death in 3 days',
      value: '−10',
    });
    expect(sourceText({ kind: 'deaths', deaths: 2, value: -20 }, 3).label).toBe(
      '2 deaths in 3 days',
    );
  });
});
