// Words for what the sim works out: alerts, the death log, the winter countdown, why a
// Workplace is idle, Carrier utilization, the Hero's knockout countdown and a Hunting ground's
// Game coming back. Pure.
import { content, type ResourceId } from '@candlemarch/content';
import {
  type Alert,
  type Death,
  type DeathCause,
  type GameOver,
  type GroundRegrowth,
  TICKS_PER_SECOND,
  type WorkplaceStatus,
} from '@candlemarch/sim';

/** "1 day", "3 days". */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function alertText(alert: Alert): string {
  switch (alert.kind) {
    case 'willStarve':
      return `${alert.name} will starve at ${alert.at}`;
    case 'willFreeze':
      return `${alert.name} will freeze at dawn`;
    case 'lowFood':
      return `About ${count(alert.days, 'day', 'days')} of Food left`;
    case 'winterFood':
      return `Food for about ${count(alert.days, 'day', 'days')}, winter in ${count(alert.winterIn, 'day', 'days')}`;
    case 'noFirewood':
      return alert.houses === 1
        ? '1 House has no firewood'
        : `${alert.houses} Houses have no firewood`;
    case 'lowFirewood':
      return `Firewood for ${count(alert.nights, 'night', 'nights')}, winter needs ${alert.needed}`;
    case 'hungry':
      return `${count(alert.villagers, 'villager', 'villagers')} Hungry`;
    case 'cold':
      return `${count(alert.villagers, 'villager', 'villagers')} Cold`;
    case 'homeless':
      return `${count(alert.villagers, 'villager', 'villagers')} Homeless`;
    case 'scarceGround':
      return `${alert.name} is ${alert.health === 'scarce' ? 'Scarce' : 'Empty'}`;
  }
}

const DIED: Record<DeathCause, string> = {
  starvation: 'starved',
  freezing: 'froze',
  gloamling: 'was killed by a Gloamling',
  den: 'was stung to death by a Den',
};

/** A message-log line: "Ada starved, day 14". */
export function deathText(death: Death): string {
  return `${death.name} ${DIED[death.cause]}, day ${death.day}`;
}

/** The game-over screen's line: "The last villager froze on day 17." */
export function gameOverText(over: GameOver): string {
  return `The last villager ${DIED[over.cause]} on day ${over.day}.`;
}

/** The autumn countdown: "Winter in 3 days". */
export function winterText(days: number): string {
  return `Winter in ${count(days, 'day', 'days')}`;
}

/** "logs", "logs and hides", "logs, fish and hides". */
function resourceList(resources: readonly ResourceId[]): string {
  const names = resources.map((r) => content.resources[r].name.toLowerCase());
  const last = names.pop();
  return names.length === 0 ? (last ?? '') : `${names.join(', ')} and ${last}`;
}

/** Why a Workplace is idle, for its panel: "Waiting for logs". */
export function workplaceStatusText(status: WorkplaceStatus): string {
  switch (status.kind) {
    case 'noWorker':
      return 'No worker';
    case 'waitingFor':
      return `Waiting for ${resourceList(status.resources)}`;
    case 'outputFull':
      return `Output full: no room for ${resourceList(status.resources)}`;
  }
}

/** Carrier utilization for the readout: "64%", or a dash when no Carrier has worked lately. */
export function utilizationText(percent: number | null): string {
  return percent === null ? '–' : `${percent}%`;
}

/** The Hero panel while it's Knocked out: "Knocked out, up in 14 s" (seconds at normal speed). */
export function knockoutText(ticksLeft: number): string {
  return `Knocked out, up in ${Math.ceil(ticksLeft / TICKS_PER_SECOND)} s`;
}

/** A Hunting ground's Game coming back: "Empty; Game returns in 6 days", "Recovering". */
export function regrowthText(regrowth: GroundRegrowth): string {
  if (regrowth.kind === 'recovering') return 'Recovering';
  if (regrowth.days === null) return 'Empty; too few trees for Game to return';
  return `Empty; Game returns in ${count(regrowth.days, 'day', 'days')}`;
}
