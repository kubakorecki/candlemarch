import type { FogDef } from './types';

// Fog (spec, World and map). Numbers Proposed.
export const fog: FogDef = {
  startRevealTiles: 12,
  sight: {
    hero: { day: 8, night: 4 },
    villager: { day: 4, night: 2 },
    building: { day: 3, night: 1 },
    mannedWatchtower: { day: 8, night: 8 },
  },
};
