// Every map a new game can start on, keyed by name, in the order the New game panel lists them.
import type { MapDef } from '../map';
import { branchingNetworkMap } from './branchingNetwork';
import { longHaulMap } from './longHaul';
import { meadowMap } from './meadow';
import { shortHaulMap } from './shortHaul';

export const maps = {
  meadow: meadowMap,
  shortHaul: shortHaulMap,
  longHaul: longHaulMap,
  branchingNetwork: branchingNetworkMap,
} satisfies Record<string, MapDef>;

export type MapName = keyof typeof maps;

/** Map used for new games. */
export const DEFAULT_MAP: MapName = 'meadow';
