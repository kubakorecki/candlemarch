import type { MapDef } from '../map';

/**
 * Branching network, 32×20. Two woodcutter's huts, at (3,4) and (26,4), have their doors (4,6)
 * and (27,6) on a road along row 6. From a Flag at (16,6) a road runs south to a Flag at (16,16)
 * serving a 3×3 stockpile at (17,15). From a Flag at (16,11) on the way, a branch runs west to
 * the door (10,11) of a hut site at (10,10). Five Segments, five Carriers.
 */
export const branchingNetworkMap: MapDef = {
  name: 'branchingNetwork',
  rows: [
    '................................',
    '.TT.TT.T..................TT.TT.',
    'TT.TT.T...............T.TT.TT.T.',
    '.T.T..T.................T.T..TT.',
    'T.............................T.',
    '................................',
    '....============F===========....',
    '................=...............',
    '................=...............',
    '................=...............',
    '................=...............',
    '..........======F...............',
    '................=...............',
    '................=...............',
    '................=...............',
    '................=...............',
    '................F...............',
    '................................',
    '................................',
    '................................',
  ],
  buildings: [
    { type: 'woodcutters_hut', x: 3, y: 4 },
    { type: 'woodcutters_hut', x: 26, y: 4 },
  ],
  sites: [{ type: 'hut', x: 10, y: 10 }],
  stockpiles: [{ x: 17, y: 15, w: 3, h: 3 }],
  villagers: [
    { job: 'carrier', x: 13, y: 8 },
    { job: 'carrier', x: 14, y: 8 },
    { job: 'carrier', x: 18, y: 8 },
    { job: 'carrier', x: 19, y: 8 },
    { job: 'carrier', x: 20, y: 8 },
  ],
};
