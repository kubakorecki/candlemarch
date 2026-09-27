// Spoilage (ADR-0002): at each Dawn every stack of Food in a building (a Granary, or a workplace's
// output or input buffer) loses a share, rounded up. Food in hands and on its way doesn't spoil.
import type { Content, ResourceId } from '@candlemarch/content';
import { calendarAt, isDawn } from '../calendar';
import { idsOf } from '../entities';
import { baseSpoilPercent, foodIds } from '../granary';
import type { EntityId, GameState } from '../state';

/**
 * Percent of a stack of `resource` lost at the Dawn of `tick`: the Food's own rate scaled by the
 * season's, truncated (winter: 25% × 20% = 5%).
 */
export function spoilPercentAt(content: Content, resource: ResourceId, tick: number): number {
  const { season } = calendarAt(tick, content);
  const seasonPercent = content.calendar.seasons.find((s) => s.id === season)?.spoilPercent ?? 100;
  return Math.trunc((baseSpoilPercent(content, resource) * seasonPercent) / 100);
}

/**
 * Percent of a stack of `resource` in `building` lost at this Dawn. Every store spoils alike for
 * now; the root cellar (M6) will lower the rate here by its own percentage.
 */
function storeSpoilPercent(
  state: GameState,
  content: Content,
  _building: EntityId,
  resource: ResourceId,
): number {
  return spoilPercentAt(content, resource, state.tick);
}

/** Units a stack of `amount` loses at `percent`: rounded up, so a stack of 1 always goes. */
function spoiled(amount: number, percent: number): number {
  return Math.min(amount, Math.floor((amount * percent + 99) / 100));
}

export function spoilageSystem(state: GameState, content: Content): void {
  // The game starts at Dawn on day 1, after no night.
  if (!isDawn(state.tick, content) || calendarAt(state.tick, content).day === 1) return;
  const foods = foodIds(content);
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    if (!b) continue;
    for (const store of [b.stock, b.input]) {
      for (const resource of foods) {
        const amount = store[resource] ?? 0;
        if (amount <= 0) continue;
        store[resource] = amount - spoiled(amount, storeSpoilPercent(state, content, id, resource));
      }
    }
  }
}
