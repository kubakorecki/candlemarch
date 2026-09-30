import type { RoadDef, RoadId } from './types';

export const roads: Record<RoadId, RoadDef> = {
  dirt_path: { id: 'dirt_path', name: 'Dirt path', speedPercent: 150 },
  // Built through the Pass (a Pass road site finishes into it); walked like Meadow.
  pass_road: { id: 'pass_road', name: 'Pass road', speedPercent: 100 },
};
