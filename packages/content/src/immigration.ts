import type { ImmigrationDef } from './types';

// Five Meals in the Granaries for everyone, Newcomer included; nobody comes through winter snow.
export const immigration: ImmigrationDef = {
  mealsPerHead: 5,
  closedSeasons: ['winter'],
};
