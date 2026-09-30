import type { TerrainDef, TerrainId } from './types';

// Walking speeds are Proposed (spec, World and map: Terrain). A Road's speed replaces them.
export const terrain: Record<TerrainId, TerrainDef> = {
  meadow: { id: 'meadow', name: 'Meadow', walkable: true, buildable: true, speedPercent: 100 },
  // Only a quarry (M5) will be built on Rock.
  rock: { id: 'rock', name: 'Rock', walkable: true, buildable: false, speedPercent: 80 },
  mountain: {
    id: 'mountain',
    name: 'Mountain',
    walkable: false,
    buildable: false,
    speedPercent: 0,
  },
  // Buildable once Drained (ticket 08 turns a Drained tile into Meadow).
  swamp: { id: 'swamp', name: 'Swamp', walkable: true, buildable: false, speedPercent: 50 },
  river: { id: 'river', name: 'River', walkable: false, buildable: false, speedPercent: 0 },
  ford: { id: 'ford', name: 'Ford', walkable: true, buildable: false, speedPercent: 50 },
  // Open once a Pass road is built over it (ticket 08).
  pass_snow: {
    id: 'pass_snow',
    name: 'Pass snow',
    walkable: false,
    buildable: false,
    speedPercent: 0,
  },
};
