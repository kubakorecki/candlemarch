import type { VillagerRoleDef, VillagerRoleId } from './types';

export const villagerRoles: Record<VillagerRoleId, VillagerRoleDef> = {
  woodcutter: {
    id: 'woodcutter',
    name: 'Woodcutter',
    walkSpeed: 75, // 1.5 tiles per second
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  carrier: {
    id: 'carrier',
    name: 'Carrier',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
};
