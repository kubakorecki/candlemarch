import type { PoiDef, PoiId } from './types';

// Points of interest (spec, World and map: "Points of interest"; numbers Proposed). The Abandoned
// mine is only a marker until M5; M6 adds trapped masters to Ruins.
export const pois: Record<PoiId, PoiDef> = {
  ruins: {
    id: 'ruins',
    name: 'Ruins',
    search: {
      ticks: 200, // 10 s, by day
      cache: [
        { resource: 'firewood', amount: 15 },
        { resource: 'hides', amount: 6 },
        { resource: 'tools', amount: 2 },
      ],
      coin: 50,
      spreadPercent: 30,
    },
  },
  abandoned_mine: { id: 'abandoned_mine', name: 'Abandoned mine' },
  shrine: { id: 'shrine', name: 'Shrine', wardTiles: 12 },
};
