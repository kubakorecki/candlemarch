// Carrier utilization and road traffic over the last in-game day (spec, Logistics: "Making
// bottlenecks readable"). The day is kept as `TRAFFIC_SLICES` slices of counts in
// `state.traffic`; the numbers the client shows are derived from them.
import type { Content } from '@candlemarch/content';
import type { EntityId, GameState, TrafficSlice } from './state';
import { isHelpingCarry } from './villagers';

/** Slices a day is counted in. The window is the current slice and the ones before it. */
export const TRAFFIC_SLICES = 24;

/** Ticks one slice lasts: a day's share, rounded up. */
function sliceTicks(content: Content): number {
  return Math.ceil(content.calendar.dayTicks / TRAFFIC_SLICES);
}

function sliceAt(tick: number, content: Content): number {
  return Math.floor(tick / sliceTicks(content));
}

/** Slices still inside the window at the state's tick, oldest first. */
function windowSlices(state: GameState, content: Content): TrafficSlice[] {
  const now = sliceAt(state.tick, content);
  return state.traffic.filter((t) => t.slice > now - TRAFFIC_SLICES && t.slice <= now);
}

/** The slice counting this tick, started if needed; slices that left the window are dropped. */
export function currentSlice(state: GameState, content: Content): TrafficSlice {
  const now = sliceAt(state.tick, content);
  const last = state.traffic[state.traffic.length - 1];
  if (last && last.slice === now) return last;
  state.traffic = windowSlices(state, content);
  const slice: TrafficSlice = { slice: now, carrierTicks: 0, haulTicks: 0, roadSteps: {} };
  state.traffic.push(slice);
  return slice;
}

/**
 * Whether villager `id` counts as a Carrier here: a Carrier, or a worker helping carry, who counts
 * only while it holds a Haul.
 */
export function isCarrier(state: GameState, id: EntityId): boolean {
  return state.components.villager[id]?.job === 'carrier' || isHelpingCarry(state, id);
}

/** Counts walker `id` stepping onto tile `index`: a Carrier onto a Road tile. */
export function countStep(state: GameState, content: Content, id: EntityId, index: number): void {
  if (!isCarrier(state, id) || state.map.roads[index] === undefined) return;
  const slice = currentSlice(state, content);
  slice.roadSteps[index] = (slice.roadSteps[index] ?? 0) + 1;
}

/**
 * Share of Carriers holding a Haul over the last in-game day, as a whole percent rounded down:
 * ticks Carriers spent holding one ÷ ticks Carriers spent at work. Null when no Carrier worked
 * in that time.
 */
export function carrierUtilization(state: GameState, content: Content): number | null {
  let carrierTicks = 0;
  let haulTicks = 0;
  for (const t of windowSlices(state, content)) {
    carrierTicks += t.carrierTicks;
    haulTicks += t.haulTicks;
  }
  return carrierTicks === 0 ? null : Math.floor((100 * haulTicks) / carrierTicks);
}

/**
 * Carrier steps onto each Road tile over the last in-game day, by tile index. Roads removed since
 * are left out.
 */
export function roadTraffic(state: GameState, content: Content): Record<number, number> {
  const steps: Record<number, number> = {};
  for (const t of windowSlices(state, content)) {
    for (const [index, n] of Object.entries(t.roadSteps)) {
      const i = Number(index);
      if (state.map.roads[i] === undefined) continue;
      steps[i] = (steps[i] ?? 0) + n;
    }
  }
  return steps;
}
