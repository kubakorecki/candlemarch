// Construction sites turn into buildings once all materials are in and the build time has passed.
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import type { GameState } from '../state';

export function constructionSystem(state: GameState, content: Content): void {
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
      building[id] = { type: site.type, stock: {} };
    }
  }
}
