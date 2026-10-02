import type { HappinessDef } from './types';

// Happiness is about the good life, not survival (spec, Villagers: Happiness in M5). Every number
// is Proposed. The likes and dislikes of buildings are their `adjacency` (buildings.ts, pois.ts).
export const happiness: HappinessDef = {
  start: 50,
  max: 100,
  homeless: -30,
  death: -10,
  deathDays: 3,
  happyAt: 70,
  happySpeedPercent: 120,
  unhappyBelow: 30,
  unhappySpeedPercent: 80,
  leaveAfterDawns: 5,
  closedSeasons: ['winter'],
  reachTiles: 4,
  woods: { objects: ['tree'], value: 10 },
};
