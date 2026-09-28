// Light sources: what the client draws a warm glow around at night. Derived, never stored.
// House windows glow but give no Light (ADR-0003): Gloamlings walk right up to them.
import type { Content } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { isAtHome, residentsOf } from './homes';
import type { EntityId, GameState } from './state';
import { isHouse } from './warmth';

/** Something glowing at night: `window` is a lit House, with no lit ground around it. */
export interface LightSource {
  id: EntityId;
  kind: 'window';
}

/**
 * What glows right now, in ID order: at night, every House with a resident at Home, unless it's
 * cold (no fuel burned tonight). Nothing by day.
 */
export function lightSources(state: GameState, content: Content): LightSource[] {
  if (!calendarAt(state.tick, content).isNight) return [];
  const lights: LightSource[] = [];
  for (const id of idsOf(state.components.building)) {
    if (!isHouse(state, content, id) || state.components.building[id]?.cold) continue;
    const someoneIn = residentsOf(state, id).some((v) => isAtHome(state, content, v));
    if (someoneIn) lights.push({ id, kind: 'window' });
  }
  return lights;
}
