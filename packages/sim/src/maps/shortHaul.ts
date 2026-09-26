import type { MapDef } from '../map';

/**
 * Short haul, 20×14: a woodcutter's hut at (4,5) with its door (5,7) on a 6-tile path east to
 * (10,7), next to a 3×3 stockpile at (11,6). Two Carriers.
 */
export const shortHaulMap: MapDef = {
  name: 'shortHaul',
  rows: [
    '....................',
    '..TT.TT.............',
    '.TT.TT.T............',
    '..T.TT..T...........',
    '.T..................',
    '....................',
    '....................',
    '.....======.........',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
  ],
  buildings: [{ type: 'woodcutters_hut', x: 4, y: 5 }],
  stockpiles: [{ x: 11, y: 6, w: 3, h: 3 }],
  villagers: [
    { job: 'carrier', x: 7, y: 10 },
    { job: 'carrier', x: 8, y: 10 },
  ],
  hero: { x: 10, y: 11 },
};
