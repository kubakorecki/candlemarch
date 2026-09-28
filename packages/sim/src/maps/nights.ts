import type { MapDef } from '../map';

/**
 * Nights at the Camp, 30×22: a small village already standing west of a two-tree-thick wood that
 * runs from the north edge down to the river, with one gap (17–18, 9–11). A Den lies in the wilds
 * past the gap at (25,10). Three Huts (doors at (3,4), (6,4), (9,4)), a Granary with 20 fish, two
 * fisher's huts on the river and a 3×2 Stockpile with 32 logs and 16 firewood; four Carriers and
 * the two fishers. No Hero, so what keeps the village alive is what it builds. Newcomers enter at
 * (0,11).
 */
export const nightsMap: MapDef = {
  name: 'nights',
  rows: [
    '............T....TT...........',
    '.T...............TT...........',
    '.................TT...........',
    '.................TT...T.......',
    '.................TT...........',
    '.................TT...........',
    '.................TT........T..',
    '.................TT...........',
    '.................TT...........',
    '..............................',
    '.........................D....',
    '..............................',
    '.................TT...........',
    '.................TT.........T.',
    '.................TT...........',
    '.................TT.....T.....',
    '..............T..TT...........',
    '.................TT..T........',
    '.................TT...........',
    '.................TT...........',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  entry: { x: 0, y: 11 },
  buildings: [
    { type: 'hut', x: 3, y: 3 },
    { type: 'hut', x: 6, y: 3 },
    { type: 'hut', x: 9, y: 3 },
    { type: 'granary', x: 6, y: 13, stock: [{ resource: 'fish', amount: 20 }] },
    { type: 'fishers_hut', x: 5, y: 18 },
    { type: 'fishers_hut', x: 10, y: 18 },
  ],
  stockpiles: [
    {
      x: 2,
      y: 13,
      w: 3,
      h: 2,
      goods: [
        { resource: 'logs', amount: 32 },
        { resource: 'firewood', amount: 16 },
      ],
    },
  ],
  villagers: [
    { job: 'carrier', x: 4, y: 11 },
    { job: 'carrier', x: 5, y: 11 },
    { job: 'carrier', x: 6, y: 11 },
    { job: 'carrier', x: 7, y: 11 },
  ],
};
