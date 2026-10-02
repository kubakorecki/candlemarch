// Tools wearing out (spec, Economy: Tools: used and sold).
import type { Content } from '@candlemarch/content';
import { isDusk } from '../calendar';
import { idsOf } from '../entities';
import type { GameState } from '../state';
import { workersAt } from '../workers';

/**
 * At every Dusk each tool a worker held today (a Workplace's workers hold its tools in ID order)
 * counts a day worked; one worked `tools.wearDays` days is gone, and its Workplace asks for
 * another. Spare tools, with nobody to hold them, don't wear. Nothing wears with `wearDays` null.
 */
export function toolsSystem(state: GameState, content: Content): void {
  const { wearDays } = content.tools;
  if (wearDays === null || !isDusk(state.tick, content)) return;
  const { building } = state.components;
  for (const id of idsOf(building)) {
    const b = building[id];
    if (!b?.tools || b.tools.length === 0) continue;
    const held = workersAt(state, id).length;
    b.tools = b.tools.map((days, i) => (i < held ? days + 1 : days)).filter((d) => d < wearDays);
  }
}
