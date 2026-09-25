// Flag relay's plain-data state, and what one tick of it works with.
import type { Content, ResourceId } from '@candlemarch/content';
import type { EntityId, GameState, Store } from '../state';
import type { Network } from './flagNetwork';

/** Where a good is bound: a site or stockpile, and the Flag it's handed over at. */
export interface Destination {
  entity: EntityId;
  flag: number;
}

/** One unit of goods in the network: waiting on a Flag or in a carrier's hands. */
export interface Good {
  resource: ResourceId;
  /** Null while it has no destination. */
  to: Destination | null;
  /** Stockpile it still lies on. A carrier loads it from there before carrying it on. */
  onStockpile?: EntityId;
}

/** The road between two neighbouring Flags. */
export interface Segment {
  /** Flag tiles at its ends, the lower tile index first. */
  ends: [number, number];
  /** Road tiles from `ends[0]` to `ends[1]`, both included. */
  tiles: number[];
}

/** What a staffed carrier is doing. `flag` is the Flag it's at, or walking back to. */
export type RelayTask =
  /** Walking to `flag` empty-handed; waits there on arrival. */
  | { kind: 'toFlag'; flag: number }
  /** Standing at `flag`, waiting for goods to move. */
  | { kind: 'idle'; flag: number }
  /** Walking to stockpile tile `tile` to load the good it's assigned. */
  | { kind: 'load'; flag: number; tile: number }
  /** Walking back to `flag` with a good loaded from a stockpile, to carry it on from there. */
  | { kind: 'back'; flag: number }
  /** Carrying a good along the Segment to `flag`. Waits there while the Flag is full. */
  | { kind: 'carry'; flag: number }
  /** Walking to stockpile tile `tile` to unload the good, then back to `flag`. */
  | { kind: 'unload'; flag: number; tile: number };

export interface RelayCarrier {
  segment: number;
  task: RelayTask;
  /** The good in its hands, or assigned to it while it walks to load it. */
  good: Good | null;
}

export interface FlagRelayState {
  model: 'flagRelay';
  /** Tile indices of placed Flags, ascending. Doors on roads are Flags too but aren't listed. */
  flags: number[];
  /** Goods waiting on each Flag (placed or door), keyed by Flag tile, in arrival order. */
  waiting: Record<number, Good[]>;
  /** Segments of the current road network, keyed by Segment ID. Lower IDs are older. */
  segments: Store<Segment>;
  nextSegmentId: number;
  /** Staffed carriers, keyed by villager ID. */
  carriers: Store<RelayCarrier>;
}

export function initFlagRelay(): FlagRelayState {
  return {
    model: 'flagRelay',
    flags: [],
    waiting: {},
    segments: {},
    nextSegmentId: 1,
    carriers: {},
  };
}

/** The flag relay state, or null when the game uses another logistics model. */
export function relayOf(state: GameState): FlagRelayState | null {
  return state.logistics.model === 'flagRelay' ? state.logistics : null;
}

/** What one tick of flag relay works with. */
export interface RelayTick {
  state: GameState;
  content: Content;
  relay: FlagRelayState;
  /** The road network as it stands this tick. */
  net: Network;
}
