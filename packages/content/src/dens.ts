import type { DensDef } from './types';

// Monster Dens. Pressure grows through the seasons: more Gloamlings a night, and Dens that creep
// toward the village once a season.
export const dens: DensDef = {
  spawnsPerDusk: { spring: 1, summer: 2, autumn: 3, winter: 4 },
  darkRingTiles: 6,
  budding: { closerMin: 6, closerMax: 10, minBuildingTiles: 12, maxDens: 5 },
  cleared: {
    cache: [
      { resource: 'hides', amount: 4 },
      { resource: 'firewood', amount: 6 },
    ],
    calmTiles: 15,
    calmDays: 10,
  },
};
