// Typed game data for Candlemarch. No logic lives here.
import { alerts } from './alerts';
import { buildings } from './buildings';
import { calendar } from './calendar';
import { combat } from './combat';
import { dens } from './dens';
import { heroes } from './heroes';
import { hunting } from './hunting';
import { immigration } from './immigration';
import { jobs } from './jobs';
import { logistics } from './logistics';
import { mapObjects } from './mapObjects';
import { needs } from './needs';
import { recipes } from './recipes';
import { resources } from './resources';
import { roads } from './roads';
import { terrain } from './terrain';
import type { Content } from './types';
import { villagerNames } from './villagerNames';

export type * from './types';

export const content: Content = {
  resources,
  terrain,
  mapObjects,
  jobs,
  recipes,
  buildings,
  heroes,
  roads,
  logistics,
  calendar,
  needs,
  hunting,
  immigration,
  alerts,
  dens,
  combat,
  villagerNames,
};
