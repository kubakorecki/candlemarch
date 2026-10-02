// Words for a villager's happiness: its band and each source, for the villager and House panels.
// Pure.
import type { HappinessBand, HappinessSource } from '@candlemarch/sim';

const BANDS: Record<HappinessBand, string> = {
  happy: 'Happy',
  content: 'Content',
  unhappy: 'Unhappy',
};

/** "Happy", "Content", "Unhappy". */
export function bandText(band: HappinessBand): string {
  return BANDS[band];
}

/** A signed value with a true minus: "+10", "−30", "0". */
export function signedText(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${-value}`;
  return '0';
}

/** A source as a panel row: "Homeless" and "−30"; "2 deaths in 3 days" and "−20". */
export function sourceText(
  source: HappinessSource,
  deathDays: number,
): { label: string; value: string } {
  const value = signedText(source.value);
  switch (source.kind) {
    case 'homeless':
      return { label: 'Homeless', value };
    case 'deaths': {
      const deaths = source.deaths === 1 ? '1 death' : `${source.deaths} deaths`;
      return { label: `${deaths} in ${deathDays} days`, value };
    }
  }
}
