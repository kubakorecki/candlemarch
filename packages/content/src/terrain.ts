import type { TerrainDef, TerrainId } from './types';

export const terrain: Record<TerrainId, TerrainDef> = {
  grass: { id: 'grass', name: 'Grass', walkable: true, buildable: true },
  river: { id: 'river', name: 'River', walkable: false, buildable: false },
};
