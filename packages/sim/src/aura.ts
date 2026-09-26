// The hero's production aura (a stub until the playtest settles the hero's role): Workplaces near
// the hero work faster. Derived from positions each time it's asked; nothing is stored.
import type { Content } from '@candlemarch/content';
import { idsOf } from './entities';
import { footprint, tileOfPoint } from './grid';
import type { EntityId, GameState } from './state';

/**
 * Work speed of a building as a percentage: 100 normally, or the best `aura.speedPercent` of any
 * hero within its `aura.radiusTiles`. Only Workplaces (buildings that employ villagers) are
 * boosted. The radius is a circle around the hero's tile: a footprint tile counts when
 * dx² + dy² ≤ radius², in whole tiles.
 */
export function workSpeedPercent(state: GameState, content: Content, building: EntityId): number {
  const b = state.components.building[building];
  const origin = state.components.tile[building];
  if (!b || !origin) return 100;
  const def = content.buildings[b.type];
  if (def.employs.length === 0) return 100;
  const tiles = footprint(def, origin);

  let best = 100;
  for (const id of idsOf(state.components.hero)) {
    const hero = state.components.hero[id];
    const pos = state.components.position[id];
    if (!hero || !pos) continue;
    const { radiusTiles, speedPercent } = content.heroes[hero.type].aura;
    const at = tileOfPoint(pos);
    const inRange = tiles.some(
      (t) => (t.x - at.x) ** 2 + (t.y - at.y) ** 2 <= radiusTiles * radiusTiles,
    );
    if (inRange) best = Math.max(best, speedPercent);
  }
  return best;
}

/** Workplaces a hero's aura is boosting right now, in ID order. */
export function boostedWorkplaces(state: GameState, content: Content): EntityId[] {
  return idsOf(state.components.building).filter(
    (id) => workSpeedPercent(state, content, id) > 100,
  );
}

/**
 * Ticks a piece of work that normally takes `ticks` takes at `building` right now: scaled by
 * 100 / speed percent, truncated, and never below 1.
 */
export function workTicks(
  state: GameState,
  content: Content,
  building: EntityId,
  ticks: number,
): number {
  const percent = workSpeedPercent(state, content, building);
  return Math.max(1, Math.trunc((ticks * 100) / percent));
}
