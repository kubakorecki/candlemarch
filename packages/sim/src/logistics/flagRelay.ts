// Logistics model B (Settlers-style flag relay): Flags split roads into Segments, each worked by
// one Carrier, and goods hop Flag to Flag towards their destination.
import type { Content } from '@candlemarch/content';
import { inBounds, tileIndex } from '../grid';
import type { GameState } from '../state';
import { buildNetwork, canPlaceFlag, deriveSegments, flagTiles } from './flagNetwork';
import type { LogisticsModel } from './model';
import {
  advanceCarriers,
  reconcileSegments,
  staffSegments,
  unstaffedSegmentIds,
} from './relayCarriers';
import { checkWaitingGoods, dispatchGoods } from './relayGoods';
import { initFlagRelay, relayOf, type Segment } from './relayState';

/** Places a Flag on tile (x, y), or nothing if `canPlaceFlag` says no. */
export function placeFlag(state: GameState, content: Content, x: number, y: number): void {
  const relay = relayOf(state);
  if (!relay || !canPlaceFlag(state, content, x, y)) return;
  relay.flags.push(tileIndex(state.map, x, y));
  relay.flags.sort((a, b) => a - b);
}

/** Removes the placed Flag on tile (x, y), if there is one. Goods waiting on it are lost. */
export function removeFlag(state: GameState, x: number, y: number): void {
  const relay = relayOf(state);
  if (!relay || !inBounds(state.map, x, y)) return;
  const i = tileIndex(state.map, x, y);
  relay.flags = relay.flags.filter((f) => f !== i);
}

/** Segments without a carrier, oldest first, for the "no carrier" icon. Empty under other models. */
export function unstaffedSegments(state: GameState): Segment[] {
  const relay = relayOf(state);
  if (!relay) return [];
  return unstaffedSegmentIds(relay).map((id) => relay.segments[id] as Segment);
}

export const flagRelay: LogisticsModel = {
  init: initFlagRelay,
  /**
   * 1. Flags whose path is gone go too.
   * 2. Segments follow the road network; carriers of Segments that changed are released.
   * 3. Goods on Flags that are gone are lost; goods bound somewhere gone or unreachable lose
   *    their destination.
   * 4. Unstaffed Segments take idle carriers.
   * 5. Demands take goods from buffers, stockpiles and goods without a destination.
   * 6. Carriers move goods.
   */
  update(state, content) {
    const relay = relayOf(state);
    if (!relay) return;
    relay.flags = relay.flags.filter((i) => state.map.roads[i] !== undefined);
    const flags = flagTiles(state, content, relay);
    const segments = deriveSegments(state, flags);
    reconcileSegments(state, relay, flags, segments);
    const tick = { state, content, relay, net: buildNetwork(flags, segments) };
    checkWaitingGoods(tick);
    staffSegments(state, content, relay);
    dispatchGoods(tick);
    advanceCarriers(tick);
  },
  isIdle(state, carrier) {
    return relayOf(state)?.carriers[carrier] === undefined;
  },
};
