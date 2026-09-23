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
};
