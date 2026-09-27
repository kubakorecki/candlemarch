// Construction sites turn into buildings once all materials are in and the build time has passed.
// There are no builders: the timer runs by itself, but only by day.
import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import type { GameState } from '../state';

export function constructionSystem(state: GameState, content: Content): void {
  if (isNight(state.tick, content)) return;
  const { site: sites, building } = state.components;
  for (const id of idsOf(sites)) {
    const site = sites[id];
    const construction = site ? content.buildings[site.type].construction : undefined;
    if (!site || !construction) continue;

    const supplied = construction.cost.every((c) => (site.delivered[c.resource] ?? 0) >= c.amount);
    if (!supplied) continue;

    site.buildProgress += 1;
    if (site.buildProgress >= construction.buildTicks) {
      delete sites[id];
      building[id] = { type: site.type, stock: {}, input: {} };
    }
  }
}
