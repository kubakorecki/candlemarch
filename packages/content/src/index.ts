// Typed game data for Candlemarch. No logic lives here.
import { alerts } from './alerts';
import { buildings } from './buildings';
import { calendar } from './calendar';
import { combat } from './combat';
import { deliveries } from './deliveries';
import { dens } from './dens';
import { crops, farming } from './farming';
import { fog } from './fog';
import { heroes } from './heroes';
import { hunting } from './hunting';
import { immigration } from './immigration';
import { jobs } from './jobs';
import { logistics } from './logistics';
import { mapObjects } from './mapObjects';
import { merchants } from './merchants';
import { needs } from './needs';
import { pois } from './pois';
import { ranks } from './ranks';
import { recipes } from './recipes';
import { resources } from './resources';
import { roads } from './roads';
import { terrain } from './terrain';
import { tools } from './tools';
import { masters, trades } from './trades';
import type { Content } from './types';
import { valley } from './valley';
import { villagerNames } from './villagerNames';

export type * from './types';

export const content: Content = {
  resources,
  terrain,
  mapObjects,
  jobs,
  recipes,
  crops,
  farming,
  buildings,
  trades,
  masters,
  merchants,
  deliveries,
  tools,
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
  fog,
  valley,
  pois,
  ranks,
  villagerNames,
};
