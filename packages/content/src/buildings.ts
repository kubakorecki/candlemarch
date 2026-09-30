import type { BuildingDef, BuildingId } from './types';

export const buildings: Record<BuildingId, BuildingDef> = {
  woodcutters_hut: {
    id: 'woodcutters_hut',
    name: "Woodcutter's hut",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'woodcutter', count: 1 }],
    gathers: ['tree'],
    // A radius so the placement preview can warn when it reaches into a Hunting ground.
    workRadius: 8,
    outputBuffer: [{ resource: 'logs', capacity: 4 }],
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
    outputBuffer: [{ resource: 'fish', capacity: 4 }],
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  foragers_hut: {
    id: 'foragers_hut',
    name: "Forager's hut",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'forager', count: 1 }],
    gathers: ['berry_bush', 'mushroom_patch'],
    workRadius: 8,
    // Two of the forager's baskets of each.
    outputBuffer: [
      { resource: 'berries', capacity: 6 },
      { resource: 'mushrooms', capacity: 6 },
    ],
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  hunters_lodge: {
    id: 'hunters_lodge',
    name: "Hunter's lodge",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'hunter', count: 1 }],
    workRadius: 10,
    hunts: {
      huntTicks: 400, // 20 s a hunt
      catch: [
        { resource: 'meat', amount: 4 },
        { resource: 'hides', amount: 1 },
      ],
    },
    outputBuffer: [
      { resource: 'meat', capacity: 8 },
      { resource: 'hides', capacity: 4 },
    ],
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  foresters_lodge: {
    id: 'foresters_lodge',
    name: "Forester's lodge",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'forester', count: 1 }],
    workRadius: 6,
    plants: { object: 'sapling', on: 'meadow', spacing: 2, plantTicks: 100 }, // 5 s a Sapling
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
  granary: {
    id: 'granary',
    name: 'Granary',
    size: { w: 2, h: 2 },
    door: { x: 1, y: 2 },
    placeable: true,
    employs: [],
    foodCapacity: 100,
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
    outputBuffer: [{ resource: 'firewood', capacity: 4 }],
    // Enough not to turn every log into firewood (spec, Firewood). Standing orders make it editable in M5.
    stockTarget: { resource: 'firewood', amount: 40 },
    construction: {
      cost: [{ resource: 'logs', amount: 3 }],
      buildTicks: 100, // 5 s
    },
  },
  // Lights (spec, Nights in v1): Gloamlings never step onto a lit tile (ADR-0003).
  torch: {
    id: 'torch',
    name: 'Torch',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    light: { radiusTiles: 2, fuel: 'firewood', burnPerNight: 1, holds: 3 },
    construction: {
      cost: [{ resource: 'logs', amount: 1 }],
      buildTicks: 60, // 3 s
    },
  },
  brazier: {
    id: 'brazier',
    name: 'Brazier',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    light: { radiusTiles: 4, fuel: 'firewood', burnPerNight: 2, holds: 6 },
    construction: {
      cost: [{ resource: 'logs', amount: 4 }],
      buildTicks: 100, // 5 s
    },
  },
  // Militia bell (spec, Nights in v1): calls every villager to arms.
  bell: {
    id: 'bell',
    name: 'Militia bell',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    bell: { rangeTiles: 10 },
    onePerVillage: true,
    construction: {
      cost: [{ resource: 'logs', amount: 5 }],
      buildTicks: 100, // 5 s
    },
  },
  // Watchtower (spec, Nights in v1): its Watchman stands in it by night and it shoots Gloamlings.
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'watchman', count: 1 }],
    watch: { rangeTiles: 6, damage: 5, cooldownTicks: 30 }, // 4 shots kill a Gloamling
    construction: {
      cost: [{ resource: 'logs', amount: 12 }],
      buildTicks: 200, // 10 s
    },
  },
  // Palisades (spec, Nights in v1): wall segments laid by dragging. The door is the segment's own
  // tile: villagers stand on the site to deliver, and a built wall is never visited.
  palisade: {
    id: 'palisade',
    name: 'Palisade',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    wall: { hp: 100, gate: false },
    construction: {
      cost: [{ resource: 'logs', amount: 2 }],
      buildTicks: 40, // 2 s
    },
  },
  gate: {
    id: 'gate',
    name: 'Gate',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    wall: { hp: 100, gate: true },
    construction: {
      cost: [{ resource: 'logs', amount: 4 }],
      buildTicks: 80, // 4 s
    },
  },
  // Groundwork (M4, spec World and map: Terrain), laid tile by tile like a Road. Numbers Proposed.
  drain: {
    id: 'drain',
    name: 'Drain',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    groundwork: { on: 'swamp', becomes: { terrain: 'meadow' } },
    construction: {
      cost: [{ resource: 'logs', amount: 2 }],
      buildTicks: 200, // 10 s
    },
  },
  pass_road: {
    id: 'pass_road',
    name: 'Pass road',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    groundwork: { on: 'pass_snow', becomes: { road: 'pass_road' } },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 600, // 30 s
    },
  },
};
