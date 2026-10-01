// Construction sites turn into buildings once all materials are in and the build time has passed.
// There are no builders: the timer runs by itself, but only by day. Groundwork (a Drain, a Pass
// road) leaves no building: it changes its tile instead.
import type { Content } from '@candlemarch/content';
import { isNight } from '../calendar';
import { idsOf } from '../entities';
import { finishGroundwork, groundworkOf } from '../groundwork';
import { mapChanged } from '../mapCache';
import { defaultStandingOrder } from '../standingOrders';
import type { GameState } from '../state';
import { fullHp } from '../walls';
import { maxWorkers } from '../workers';

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
      const groundwork = groundworkOf(content, site.type);
      if (groundwork) {
        finishGroundwork(state, id, groundwork); // leaves no building
        continue;
      }
      delete sites[id];
      mapChanged(state); // a finished wall starts blocking
      building[id] = {
        type: site.type,
        rotation: site.rotation,
        stock: {},
        input: {},
        workerLimit: maxWorkers(content, site.type),
        cold: false,
        lit: false,
        hp: fullHp(content, site.type),
        standingOrder: defaultStandingOrder(content, site.type),
      };
    }
  }
}
