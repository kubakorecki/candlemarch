import type { ResourceDef, ResourceId } from './types';

export const resources: Record<ResourceId, ResourceDef> = {
  logs: { id: 'logs', name: 'Logs', storage: 'stockpile' },
  firewood: { id: 'firewood', name: 'Firewood', storage: 'stockpile' },
  fish: { id: 'fish', name: 'Fish', storage: 'granary', spoilPercent: 25 },
  berries: { id: 'berries', name: 'Berries', storage: 'granary', spoilPercent: 35 },
  mushrooms: { id: 'mushrooms', name: 'Mushrooms', storage: 'granary', spoilPercent: 35 },
};
