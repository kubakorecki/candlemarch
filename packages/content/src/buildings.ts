import type { BuildingDef, BuildingId } from './types';

export const buildings: Record<BuildingId, BuildingDef> = {
  woodcutters_hut: {
    id: 'woodcutters_hut',
    name: "Woodcutter's hut",
    size: { w: 2, h: 2 },
    door: { x: 1, y: 2 },
    placeable: true,
    employs: [{ job: 'woodcutter', count: 1 }],
    gathers: 'tree',
    outputBuffer: { resource: 'logs', capacity: 4 },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  hut: {
    id: 'hut',
    name: 'Hut',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    construction: {
      cost: [{ resource: 'logs', amount: 10 }],
      buildTicks: 200, // 10 s
    },
  },
};
