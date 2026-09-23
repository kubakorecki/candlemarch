// Typed game data for Candlemarch. No logic lives here.
import { buildings } from './buildings';
import { mapObjects } from './mapObjects';
import { resources } from './resources';
import { terrain } from './terrain';
import type { Content } from './types';
import { villagerRoles } from './villagerRoles';

export type * from './types';

export const content: Content = {
  resources,
  terrain,
  mapObjects,
  villagerRoles,
  buildings,
};
