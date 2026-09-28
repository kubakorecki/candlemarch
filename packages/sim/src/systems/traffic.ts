// Counts Carriers at work, and those holding a Haul, for carrier utilization (`traffic.ts`).
import type { Content } from '@candlemarch/content';
import { idsOf } from '../entities';
import type { GameState } from '../state';
import { currentSlice, isCarrier } from '../traffic';
import { isAtWork } from '../villagers';

/** Adds this tick's Carriers at work (`isAtWork`) and those of them holding a Haul. */
export function trafficSystem(state: GameState, content: Content): void {
  const { villager } = state.components;
  const atWork = idsOf(villager).filter((id) => {
    const v = villager[id];
    return v !== undefined && isCarrier(state, id) && isAtWork(v);
  });
  if (atWork.length === 0) return;
  const slice = currentSlice(state, content);
  slice.carrierTicks += atWork.length;
  slice.haulTicks += atWork.filter((id) => state.logistics.hauls[id] !== undefined).length;
}
