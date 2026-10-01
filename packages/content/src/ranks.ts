import type { RankDef } from './types';

// The rank table (spec, Progression). Resident numbers Proposed; the tavern and the guildhall come
// with later milestones, so Village and Town can't be reached yet. The tickets that add a building
// put it in the rank that unlocks it.
export const ranks: readonly RankDef[] = [
  {
    id: 'camp',
    name: 'Camp',
    building: null,
    residents: 0,
    unlocks: {
      buildings: [
        'hut',
        'granary',
        'woodcutters_hut',
        'fishers_hut',
        'foragers_hut',
        'hunters_lodge',
        'foresters_lodge',
        'chopping_block',
        'torch',
        'brazier',
        'bell',
        'watchtower',
        'palisade',
        'gate',
        'drain',
        'pass_road',
        'village_hall',
        'quarry', // the village hall needs stone
      ],
    },
  },
  {
    id: 'hamlet',
    name: 'Hamlet',
    building: 'village_hall',
    residents: 10,
    unlocks: { buildings: ['notice_board', 'clay_pit', 'mine', 'bog_iron_digger', 'farm'] },
  },
  { id: 'village', name: 'Village', building: null, residents: 25, unlocks: { buildings: [] } },
  { id: 'town', name: 'Town', building: null, residents: 50, unlocks: { buildings: [] } },
];
