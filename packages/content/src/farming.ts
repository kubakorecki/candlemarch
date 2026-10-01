import type { CropDef, CropId, FarmingDef } from './types';

// Farms and crops (spec, Resources: Farms and crops; numbers Proposed). A year is 4 seasons of 5
// days: grain sown in spring is ripe 7 days later, from late summer, and harvested into autumn.
export const crops: Record<CropId, CropDef> = {
  grain: { id: 'grain', name: 'Grain', resource: 'grain', growDays: 7, yieldPerField: 3 },
};

export const farming: FarmingDef = {
  fieldOn: 'meadow',
  defaultCrop: 'grain',
  sowSeason: 'spring',
  idleSeason: 'winter',
  sowTicks: 60, // 3 s a Field
  harvestTicks: 80, // 4 s
  clearTicks: 60,
  fieldstonePercent: 25, // about 1 Field in 4 each spring
  fieldstone: { resource: 'stone', amount: 1 },
};
