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
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
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
  carrier: {
    id: 'carrier',
    name: 'Carrier',
    walkSpeed: 75,
    carryCapacity: 1,
    idleRetryTicks: 20,
  },
};
