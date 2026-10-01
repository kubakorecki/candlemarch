// What renews each spring (spec, Resources: Renewing what runs out): at the first Dawn of each
// spring, every Deposit that refills (clay) regains its `springRefillPercent` of its starting
// amount, up to that amount, even once dug out, every tile's bog iron is back up to its cap, and
// about 1 Field in 4 throws up a Fieldstone (`fields.ts`).
// Stone and iron ore Deposits never come back.
import type { Content } from '@candlemarch/content';
import { refillOre } from '../bogIron';
import { calendarAt, isDawn } from '../calendar';
import { idsOf } from '../entities';
import { throwUpFieldstones } from '../fields';
import { staticChanged } from '../snapshot';
import type { GameState } from '../state';

export function renewalSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  const { day, dayOfSeason, season } = calendarAt(state.tick, content);
  // The game starts in spring with everything full.
  if (season !== 'spring' || dayOfSeason !== 1 || day === 1) return;
  refillOre(state);
  throwUpFieldstones(state, content);
  const { mapObject } = state.components;
  for (const id of idsOf(mapObject)) {
    const obj = mapObject[id];
    const def = obj ? content.mapObjects[obj.type] : undefined;
    const percent = def?.deposit?.springRefillPercent;
    if (!obj || !def || percent === undefined) continue;
    const amount = Math.min(def.amount, obj.amount + Math.floor((def.amount * percent) / 100));
    if (amount === obj.amount) continue;
    obj.amount = amount;
    staticChanged(state);
  }
}
