// Logistics model A: a dispatcher hands each idle carrier one haul (pick up at A, drop at B).
import type { ResourceId } from '@candlemarch/content';
import type { EntityId, Store } from '../state';

export interface HaulJob {
  resource: ResourceId;
  /** Building to pick up from. */
  from: EntityId;
  /** Construction site to deliver to. */
  to: EntityId;
  /** `pickup`: walking to `from`. `dropoff`: carrying to `to`. `return`: carrying back to `from` because `to` is gone. */
  phase: 'pickup' | 'dropoff' | 'return';
}

export interface JobDispatchState {
  model: 'jobDispatch';
  /** Current job per carrier, keyed by the carrier's entity ID. */
  jobs: Store<HaulJob>;
}

export function initJobDispatch(): JobDispatchState {
  return { model: 'jobDispatch', jobs: {} };
}
