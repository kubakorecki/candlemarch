// Pure wording for the trade post's panel: prices in coin and when the next Merchant comes.

/** A price kept in hundredths of a coin, in coin: 200 → "2.00", 45 → "0.45". */
export function priceText(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const cents = hundredths % 100;
  return `${whole}.${cents.toString().padStart(2, '0')}`;
}

/**
 * When Merchants come, from today's day, the day the next one arrives and whether one is here:
 * "A Merchant is here until dawn", "Next Merchant tomorrow", "Next Merchant in 3 days".
 */
export function merchantText(today: number, next: number, here: boolean): string {
  if (here) return 'A Merchant is here until dawn';
  const days = next - today;
  return days === 1 ? 'Next Merchant tomorrow' : `Next Merchant in ${days} days`;
}
