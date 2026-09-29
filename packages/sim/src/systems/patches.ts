// Forage patches refill at the first Dawn of each season: to that season's stock while a tree
// shades them, or to nothing once they've withered. Last season's leftovers don't carry over.
import type { Content } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { idsOf } from '../entities';
import { isWithered } from '../forage';
import { staticChanged } from '../snapshot';
import type { GameState } from '../state';

export function patchesSystem(state: GameState, content: Content): void {
  if (!isDawn(state.tick, content)) return;
  const { day, dayOfSeason, season } = calendarAt(state.tick, content);
  // The game starts with every patch holding the first season's stock (content's `amount`).
  if (dayOfSeason !== 1 || day === 1) return;
  const { mapObject } = state.components;
  for (const id of idsOf(mapObject)) {
    const obj = mapObject[id];
    const forage = obj ? content.mapObjects[obj.type].forage : undefined;
    if (!obj || !forage) continue;
    const amount = isWithered(state, content, id) ? 0 : forage.stock[season];
    if (obj.amount === amount) continue;
    obj.amount = amount;
    staticChanged(state);
  }
}
