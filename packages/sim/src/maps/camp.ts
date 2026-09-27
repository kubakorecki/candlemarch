import type { MapDef } from '../map';

/**
 * The Starting Camp (spec, Progression), 30×22. Pinewood fills the north-west; the Old Wood, a
 * Hunting ground, lies east with berry bushes and mushroom patches along its edge in the trees'
 * shade. A river runs along the south edge. A Granary with 20 meat and a 2×2 Stockpile with 30
 * logs stand by the entry (0,15), where the 5 Homeless Carriers and the hero start. No Houses or
 * Workplaces.
 */
export const campMap: MapDef = {
  name: 'camp',
  rows: [
    '..............................',
    '..............................',
    '..TT.TTT.TT...................',
    '.TTT.TT.TTT...................',
    '..TTTT.TT.TT.....b.T.TTT.T.T..',
    '.TT.TTTT.TT.......TTT.T.TTTT..',
    '..T.TT.TTT.T....b..TT.TTT.T.T.',
    '.TT.T.TT.TT.......TT.T.TT.TT..',
    '...T..T..T.......m.TTT.T.TTT..',
    '..................T.T.TTT.T.T.',
    '................b.TT.TT.TTT...',
    '.................m.T.T.TT.TT..',
    '................m.TTT.T.T.T.T.',
    '...................T.TT.TTT...',
    '.................b.m..........',
    '.....................b.m......',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  entry: { x: 0, y: 15 },
  buildings: [{ type: 'granary', x: 12, y: 14, stock: [{ resource: 'meat', amount: 20 }] }],
  stockpiles: [{ x: 9, y: 14, w: 2, h: 2, goods: [{ resource: 'logs', amount: 30 }] }],
  villagers: [
    { job: 'carrier', x: 0, y: 15 },
    { job: 'carrier', x: 0, y: 15 },
    { job: 'carrier', x: 0, y: 15 },
    { job: 'carrier', x: 0, y: 15 },
    { job: 'carrier', x: 0, y: 15 },
  ],
  hero: { x: 0, y: 15 },
  huntingGrounds: [{ name: 'Old Wood', x: 18, y: 4, w: 11, h: 10, maxGame: 20 }],
};
