import { describe, expect, it } from 'vitest';
import { merchantText, priceText } from '../src/game/tradeText';

describe('trade post wording', () => {
  it('words prices in coin with two places', () => {
    expect(priceText(200)).toBe('2.00');
    expect(priceText(1805)).toBe('18.05');
    expect(priceText(45)).toBe('0.45');
  });

  it('says when the next Merchant comes', () => {
    expect(merchantText(3, 3, true)).toBe('A Merchant is here until dawn');
    expect(merchantText(5, 6, false)).toBe('Next Merchant tomorrow');
    expect(merchantText(16, 21, false)).toBe('Next Merchant in 5 days');
  });
});
