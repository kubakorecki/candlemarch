// The hero's production aura (a stub until the playtest settles the hero's role): Workplaces near
// the hero work faster. Derived from positions each time it's asked; nothing is stored.
import type { Content } from '@candlemarch/content';
import { isKnockedOut } from './combat';
import { idsOf } from './entities';
import { footprint, tileOfPoint } from './grid';
import { heroOf } from './hero';
import type { EntityId, GameState } from './state';

/**
 * Work speed of a building as a percentage: 100 normally, or the hero's `aura.speedPercent` when
 * it's within the hero's `aura.radiusTiles`. Only Workplaces (buildings that employ villagers) are
 * boosted. The radius is a circle around the hero's tile: a footprint tile counts when
 * dx² + dy² ≤ radius², in whole tiles. A Knocked-out hero has no aura.
 */
export function workSpeedPercent(state: GameState, content: Content, building: EntityId): number {
  const b = state.components.building[building];
  const origin = state.components.tile[building];
  if (!b || !origin) return 100;
  const def = content.buildings[b.type];
  if (def.employs.length === 0) return 100;

  const id = heroOf(state);
  const hero = id === null ? undefined : state.components.hero[id];
  const pos = id === null ? undefined : state.components.position[id];
  if (id === null || !hero || !pos || isKnockedOut(state, id)) return 100;
  const { radiusTiles, speedPercent } = content.heroes[hero.type].aura;
  const at = tileOfPoint(pos);
  const inRange = footprint(def, origin, b.rotation).some(
    (t) => (t.x - at.x) ** 2 + (t.y - at.y) ** 2 <= radiusTiles * radiusTiles,
  );
  return inRange ? speedPercent : 100;
}

/** Workplaces a hero's aura is boosting right now, in ID order. */
export function boostedWorkplaces(state: GameState, content: Content): EntityId[] {
  return idsOf(state.components.building).filter(
    (id) => workSpeedPercent(state, content, id) > 100,
  );
}
