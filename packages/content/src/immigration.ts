import type { ImmigrationDef } from './types';

// Two Meals in the Granaries for everyone, Newcomer included; nobody comes through winter snow.
// (Five was out of reach: at a few Food a day, Spoilage levels the Granaries off well below it.)
export const immigration: ImmigrationDef = {
  mealsPerHead: 2,
  closedSeasons: ['winter'],
};
