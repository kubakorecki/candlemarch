import type { MapObjectDef, MapObjectId } from './types';

export const mapObjects: Record<MapObjectId, MapObjectDef> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    resource: 'logs',
    amount: 3,
    gatherTicks: 40, // 2 s at 20 ticks per second
    yieldPerGather: 1,
    walkSpeedPercent: 50, // walked through, slowly, so no Forage patch is walled in
  },
  // Forage patches never run out for good: they refill each season while a tree shades them.
  berry_bush: {
    id: 'berry_bush',
    name: 'Berry bush',
    resource: 'berries',
    amount: 3, // spring's stock: the game starts in spring
    gatherTicks: 60, // 3 s
    yieldPerGather: 1,
    forage: {
      stock: { spring: 3, summer: 8, autumn: 0, winter: 0 },
      shadedBy: 'tree',
      shadeTiles: 2,
    },
  },
  mushroom_patch: {
    id: 'mushroom_patch',
    name: 'Mushroom patch',
    resource: 'mushrooms',
    amount: 0,
    gatherTicks: 60,
    yieldPerGather: 1,
    forage: {
      stock: { spring: 0, summer: 0, autumn: 8, winter: 0 },
      shadedBy: 'tree',
      shadeTiles: 2,
    },
  },
  // Planted by a forester. Nothing gathers it: the gather numbers are unused.
  sapling: {
    id: 'sapling',
    name: 'Sapling',
    resource: 'logs',
    amount: 0,
    gatherTicks: 40,
    yieldPerGather: 1,
    grows: { into: 'tree', days: 20, stages: 3 }, // about a year of 4 seasons × 5 days
  },
  // What a felled tree leaves. It sprouts a Sapling, so a clear-cut grows back in about two years.
  stump: {
    id: 'stump',
    name: 'Stump',
    resource: 'logs',
    amount: 0,
    gatherTicks: 40,
    yieldPerGather: 1,
    grows: { into: 'sapling', days: 20, stages: 1 },
  },
  // Deposits: nothing works them until M5, which tunes these placeholder amounts and times.
  stone_deposit: {
    id: 'stone_deposit',
    name: 'Stone deposit',
    resource: 'stone',
    amount: 50,
    gatherTicks: 80,
    yieldPerGather: 1,
    deposit: { terrain: 'rock' },
  },
  clay_deposit: {
    id: 'clay_deposit',
    name: 'Clay deposit',
    resource: 'clay',
    amount: 40,
    gatherTicks: 80,
    yieldPerGather: 1,
    deposit: { terrain: 'meadow', edge: 'riverbank' },
  },
  iron_deposit: {
    id: 'iron_deposit',
    name: 'Iron deposit',
    resource: 'iron_ore',
    amount: 60,
    gatherTicks: 100,
    yieldPerGather: 1,
    deposit: { terrain: 'mountain', edge: 'face' },
  },
};
