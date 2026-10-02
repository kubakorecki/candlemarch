import type { JobDef, JobId } from './types';

export const jobs: Record<JobId, JobDef> = {
  woodcutter: {
    id: 'woodcutter',
    name: 'Woodcutter',
    walkSpeed: 75, // 1.5 tiles per second
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  woodsplitter: {
    id: 'woodsplitter',
    name: 'Woodsplitter',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  fisher: {
    id: 'fisher',
    name: 'Fisher',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  forager: {
    id: 'forager',
    name: 'Forager',
    walkSpeed: 75,
    carryCapacity: 3, // a basket: a berry bush's or mushroom patch's whole gather
    idleRetryTicks: 20,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  forester: {
    id: 'forester',
    name: 'Forester',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  // Works the night shift in a watchtower and sleeps at Home by day.
  watchman: {
    id: 'watchman',
    name: 'Watchman',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  // Raw gatherers (M5) digging Deposits and Swamp. No master needed.
  quarryman: {
    id: 'quarryman',
    name: 'Quarryman',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  clay_digger: {
    id: 'clay_digger',
    name: 'Clay digger',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  miner: {
    id: 'miner',
    name: 'Miner',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  bog_digger: {
    id: 'bog_digger',
    name: 'Bog digger',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  farmer: {
    id: 'farmer',
    name: 'Farmer',
    walkSpeed: 75,
    carryCapacity: 3, // a sack: a Field's whole harvest
    idleRetryTicks: 20,
  },
  charcoal_burner: {
    id: 'charcoal_burner',
    name: 'Charcoal burner',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  sawyer: { id: 'sawyer', name: 'Sawyer', walkSpeed: 75, carryCapacity: 1, idleRetryTicks: 20 },
  stonecutter: {
    id: 'stonecutter',
    name: 'Stonecutter',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  brickmaker: {
    id: 'brickmaker',
    name: 'Brickmaker',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  smoker: { id: 'smoker', name: 'Smoker', walkSpeed: 75, carryCapacity: 1, idleRetryTicks: 20 },
  smelter: { id: 'smelter', name: 'Smelter', walkSpeed: 75, carryCapacity: 1, idleRetryTicks: 20 },
  brewer: { id: 'brewer', name: 'Brewer', walkSpeed: 75, carryCapacity: 1, idleRetryTicks: 20 },
  carrier: {
    id: 'carrier',
    name: 'Carrier',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
};
