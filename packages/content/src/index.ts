// Typed game data for Candlemarch. No logic lives here.
import { buildings } from './buildings';
import { jobs } from './jobs';
import { logistics } from './logistics';
import { mapObjects } from './mapObjects';
import { resources } from './resources';
import { roads } from './roads';
import { terrain } from './terrain';
import type { Content } from './types';

export type * from './types';

export const content: Content = {
  resources,
  terrain,
  mapObjects,
  jobs,
  buildings,
  roads,
  logistics,
};
