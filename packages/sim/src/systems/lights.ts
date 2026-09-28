// Lights at work. At each Dusk, whatever the season, every torch and brazier burns its night's
// fuel and is lit until Dawn; one that can't stays dark all night, even if fuel arrives later. At
// Dawn every light goes out. So the lit tiles change only at Dusk and Dawn.
import type { Content } from '@candlemarch/content';
import { isDawn, isDusk } from '../calendar';
import { idsOf } from '../entities';
import { lightDef, lightFuelIn } from '../lights';
import type { GameState } from '../state';

export function lightsSystem(state: GameState, content: Content): void {
  const dawn = isDawn(state.tick, content);
  const dusk = isDusk(state.tick, content);
  if (!dawn && !dusk) return;
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    const light = lightDef(state, content, id);
    if (!b || !light) continue;
    const lit = dusk && lightFuelIn(state, content, id) >= light.burnPerNight;
    if (lit) b.stock[light.fuel] = lightFuelIn(state, content, id) - light.burnPerNight;
    b.lit = lit;
  }
}
