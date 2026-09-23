import type { ResourceDef, ResourceId } from './types';

export const resources: Record<ResourceId, ResourceDef> = {
  logs: { id: 'logs', name: 'Logs' },
};
