// The Fields' year (spec, Resources: Farms and crops), at each Dawn: at the first Dawn of the idle
// season (winter) whatever stands on a Field is lost and every Field is bare again; at the first
// Dawn of the sowing season each farm's picked Crop becomes this year's; and a sown Field whose
// time has come is ripe. Fieldstones come up with the spring renewal (`systems/renewal.ts`).
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { startSowingYear } from '../fields';
import { staticChanged } from '../snapshot';
import type { FieldTile, GameState } from '../state';

export function fieldsSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  const { season, dayOfSeason } = calendarAt(state.tick, content);
  const { farming } = content;
  if (season === farming.sowSeason && dayOfSeason === 1) startSowingYear(state);
  const winter = season === farming.idleSeason && dayOfSeason === 1;
  const { fields } = state.map;
  let changed = false;
  for (const key in fields) {
    const field = fields[Number(key)] as FieldTile;
    if (winter && field.stage !== 'bare') {
      field.stage = 'bare';
      field.crop = null;
      field.ripensAt = null;
      changed = true;
    } else if (field.stage === 'sown' && field.ripensAt !== null && state.tick >= field.ripensAt) {
      field.stage = 'ripe';
      field.ripensAt = null;
      changed = true;
    }
  }
  if (changed) staticChanged(state);
}
