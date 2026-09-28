import type { Alert } from '@candlemarch/sim';
import { describe, expect, it } from 'vitest';
import {
  alertText,
  deathText,
  gameOverText,
  knockoutText,
  utilizationText,
  winterText,
  workplaceStatusText,
} from '../src/game/alertText';

const at = { severity: 'amber', target: null } as const;

describe('alert text', () => {
  it('names who dies, and when', () => {
    const starve: Alert = { ...at, kind: 'willStarve', villager: 3, name: 'Wynn', at: 'dusk' };
    expect(alertText(starve)).toBe('Wynn will starve at dusk');
    expect(alertText({ ...at, kind: 'willFreeze', villager: 4, name: 'Oda' })).toBe(
      'Oda will freeze at dawn',
    );
  });

  it('says "about" for Food projections', () => {
    expect(alertText({ ...at, kind: 'lowFood', days: 2 })).toBe('About 2 days of Food left');
    expect(alertText({ ...at, kind: 'lowFood', days: 1 })).toBe('About 1 day of Food left');
    expect(alertText({ ...at, kind: 'winterFood', days: 8, winterIn: 3 })).toBe(
      'Food for about 8 days, winter in 3 days',
    );
  });

  it('counts Houses and villagers', () => {
    expect(alertText({ ...at, kind: 'noFirewood', houses: 4 })).toBe('4 Houses have no firewood');
    expect(alertText({ ...at, kind: 'noFirewood', houses: 1 })).toBe('1 House has no firewood');
    expect(alertText({ ...at, kind: 'lowFirewood', nights: 3, needed: 5 })).toBe(
      'Firewood for 3 nights, winter needs 5',
    );
    expect(alertText({ ...at, kind: 'hungry', villagers: 2 })).toBe('2 villagers Hungry');
    expect(alertText({ ...at, kind: 'homeless', villagers: 1 })).toBe('1 villager Homeless');
  });

  it('names a Scarce Hunting ground', () => {
    const scarce: Alert = { ...at, kind: 'scarceGround', name: 'Old Wood', health: 'scarce' };
    expect(alertText(scarce)).toBe('Old Wood is Scarce');
  });
});

describe('death and winter text', () => {
  it('logs a death with its day', () => {
    expect(deathText({ name: 'Ada', cause: 'starvation', day: 14 })).toBe('Ada starved, day 14');
    expect(deathText({ name: 'Oda', cause: 'freezing', day: 17 })).toBe('Oda froze, day 17');
    expect(deathText({ name: 'Wynn', cause: 'gloamling', day: 3 })).toBe(
      'Wynn was killed by a Gloamling, day 3',
    );
    expect(deathText({ name: 'Wynn', cause: 'den', day: 3 })).toBe(
      'Wynn was stung to death by a Den, day 3',
    );
  });

  it('says how the game ended', () => {
    expect(gameOverText({ cause: 'freezing', day: 17 })).toBe('The last villager froze on day 17.');
  });

  it('counts down to winter', () => {
    expect(winterText(3)).toBe('Winter in 3 days');
    expect(winterText(1)).toBe('Winter in 1 day');
  });
});

describe('workplace status text', () => {
  it('says why a Workplace is idle', () => {
    expect(workplaceStatusText({ kind: 'noWorker' })).toBe('No worker');
    expect(workplaceStatusText({ kind: 'waitingFor', resources: ['logs'] })).toBe(
      'Waiting for logs',
    );
    expect(workplaceStatusText({ kind: 'waitingFor', resources: ['logs', 'hides'] })).toBe(
      'Waiting for logs and hides',
    );
    expect(workplaceStatusText({ kind: 'outputFull', resources: ['firewood'] })).toBe(
      'Output full: no room for firewood',
    );
  });
});

describe('carrier utilization text', () => {
  it('reads as a percent, or a dash before any Carrier has worked', () => {
    expect(utilizationText(64)).toBe('64%');
    expect(utilizationText(null)).toBe('–');
  });
});

describe('knockout text', () => {
  it('counts down the seconds, at normal speed, until the Hero gets up', () => {
    expect(knockoutText(400)).toBe('Knocked out, up in 20 s');
    expect(knockoutText(1)).toBe('Knocked out, up in 1 s');
  });
});
