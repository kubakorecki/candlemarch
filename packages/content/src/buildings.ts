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
  fishers_hut: {
    id: 'fishers_hut',
    name: "Fisher's hut",
    // 1×1 with the door straight ahead, so either bank of a north-south river fits it.
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    doorOnRiverbank: true,
    employs: [{ job: 'fisher', count: 1 }],
    fishes: { catchTicks: 400, yieldPerCatch: 1 }, // 20 s a fish
    outputBuffer: { resource: 'fish', capacity: 4 },
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
    residents: 3,
    construction: {
      cost: [{ resource: 'logs', amount: 10 }],
      buildTicks: 200, // 10 s
    },
  },
  chopping_block: {
    id: 'chopping_block',
    name: 'Chopping block',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'woodsplitter', count: 1 }],
    recipes: ['split_logs'],
    inputBuffer: [{ resource: 'logs', capacity: 4 }],
    outputBuffer: { resource: 'firewood', capacity: 4 },
    // Enough not to turn every log into firewood (spec, Firewood). Standing orders make it editable in M5.
    stockTarget: { resource: 'firewood', amount: 40 },
    construction: {
      cost: [{ resource: 'logs', amount: 3 }],
      buildTicks: 100, // 5 s
    },
  },
};
