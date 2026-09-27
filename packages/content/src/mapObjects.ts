import type { MapObjectDef, MapObjectId } from './types';

export const mapObjects: Record<MapObjectId, MapObjectDef> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    resource: 'logs',
    amount: 3,
    gatherTicks: 40, // 2 s at 20 ticks per second
    yieldPerGather: 1,
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
};
