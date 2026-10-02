// Words for a villager's happiness: its band and each source, for the villager and House panels,
// and the placement preview's badges and note. Pure.
import { content } from '@candlemarch/content';
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

/** A placement badge's tone for a change of `value`: liked, disliked or none. */
export function badgeTone(value: number): 'liked' | 'disliked' | 'none' {
  if (value > 0) return 'liked';
  if (value < 0) return 'disliked';
  return 'none';
}

/** What a neighbour is: "woods", "the Shrine", "the Smokehouse". */
function neighbourName(source: HappinessSource): string {
  switch (source.kind) {
    case 'woods':
      return 'woods';
    case 'poi':
      return `the ${content.pois[source.poi].name}`;
    case 'building':
      return `the ${content.buildings[source.building].name}`;
    default:
      return '';
  }
}

/** A source as a panel row: "Homeless" and "−30"; "2 deaths in 3 days"; "Near the Smokehouse". */
export function sourceText(source: HappinessSource): { label: string; value: string } {
  const value = signedText(source.value);
  switch (source.kind) {
    case 'homeless':
      return { label: 'Homeless', value };
    case 'deaths': {
      const deaths = source.deaths === 1 ? '1 death' : `${source.deaths} deaths`;
      return { label: `${deaths} in ${content.happiness.deathDays} days`, value };
    }
    default:
      return { label: `Near ${neighbourName(source)}`, value };
  }
}

/**
 * The placement note for a House: "Its neighbours add +10: woods +10, the Smokehouse −10, the
 * Brewery +10." Null with none.
 */
export function neighboursText(sources: readonly HappinessSource[], total: number): string | null {
  if (sources.length === 0) return null;
  const list = sources.map((s) => `${neighbourName(s)} ${signedText(s.value)}`).join(', ');
  return `Its neighbours add ${signedText(total)}: ${list}.`;
}
