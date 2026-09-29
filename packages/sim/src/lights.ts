// Light. Torches and braziers (buildings with a `light` def) keep firewood in their `stock` and
// burn a night's worth at each Dusk (`systems/lights.ts`); one lit casts Light on the tiles around
// it until Dawn. Gloamlings never step onto a lit tile (ADR-0003). House windows glow but give no
// Light: Gloamlings walk right up to them. Everything here is derived, never stored, except the
// `lit` flag set at Dusk.
import type { Content, LightDef } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { entityLayout, inBounds, tileIndex } from './grid';
import { isAtHome, residentsOf } from './homes';
import { cached } from './mapCache';
import type { EntityId, GameState } from './state';
import { isHouse } from './warmth';

/**
 * Something glowing at night: `window` is a lit House, with no lit ground around it; `light` is a
 * lit torch or brazier casting Light `radiusTiles` around it.
 */
export type LightSource =
  | { id: EntityId; kind: 'window' }
  | { id: EntityId; kind: 'light'; radiusTiles: number };

/** The light def of building `id`, or undefined when it isn't a light. */
export function lightDef(state: GameState, content: Content, id: EntityId): LightDef | undefined {
  const b = state.components.building[id];
  return b ? content.buildings[b.type].light : undefined;
}

/** Units of its fuel light `id` holds; 0 for anything that isn't a light. */
export function lightFuelIn(state: GameState, content: Content, id: EntityId): number {
  const light = lightDef(state, content, id);
  return light ? (state.components.building[id]?.stock[light.fuel] ?? 0) : 0;
}

/** Units of fuel light `id` still asks for (not counting anything on its way), every season. */
export function lightFuelRoom(state: GameState, content: Content, id: EntityId): number {
  const light = lightDef(state, content, id);
  return light ? Math.max(0, light.holds - lightFuelIn(state, content, id)) : 0;
}

/**
 * Whether light `id` is dark when it should burn: tonight, when it couldn't burn fuel at Dusk; by
 * day, when it holds less than a night's fuel. For the client's "no firewood" icon.
 */
export function isDarkLight(state: GameState, content: Content, id: EntityId): boolean {
  const light = lightDef(state, content, id);
  const b = state.components.building[id];
  if (!light || !b) return false;
  if (calendarAt(state.tick, content).isNight) return !b.lit;
  return lightFuelIn(state, content, id) < light.burnPerNight;
}

/**
 * Tiles within reach of the lights `lit` picks, by tile index (1 = covered): every tile within a
 * light's `radiusTiles` of its footprint (Chebyshev).
 */
function coverGrid(state: GameState, content: Content, lit: (id: EntityId) => boolean): Uint8Array {
  const { map } = state;
  const grid = new Uint8Array(map.width * map.height);
  for (const id of idsOf(state.components.building)) {
    const light = lightDef(state, content, id);
    if (!light || !lit(id)) continue;
    const r = light.radiusTiles;
    for (const t of entityLayout(state, content, id)?.tiles ?? []) {
      for (let y = t.y - r; y <= t.y + r; y++) {
        for (let x = t.x - r; x <= t.x + r; x++) {
          if (inBounds(map, x, y)) grid[tileIndex(map, x, y)] = 1;
        }
      }
    }
  }
  return grid;
}

/** Tiles lit tonight, by tile index (1 = lit). Changes only at Dusk and Dawn. */
export function litGrid(state: GameState, content: Content): Uint8Array {
  return cached(state, content, 'lit', () =>
    coverGrid(state, content, (id) => state.components.building[id]?.lit === true),
  );
}

/**
 * Tiles any light standing on the map would light, fuelled or not, by tile index (1 = in reach).
 * Dens never bud there.
 */
export function lightReachGrid(state: GameState, content: Content): Uint8Array {
  return coverGrid(state, content, () => true);
}

/**
 * What glows right now, in ID order: at night, every House with a resident at Home, unless it's
 * cold (no fuel burned tonight), and every lit torch and brazier. Nothing by day.
 */
export function lightSources(state: GameState, content: Content): LightSource[] {
  if (!calendarAt(state.tick, content).isNight) return [];
  const lights: LightSource[] = [];
  for (const id of idsOf(state.components.building)) {
    const b = state.components.building[id];
    const light = lightDef(state, content, id);
    if (light) {
      if (b?.lit) lights.push({ id, kind: 'light', radiusTiles: light.radiusTiles });
      continue;
    }
    if (!isHouse(state, content, id) || b?.cold) continue;
    const someoneIn = residentsOf(state, id).some((v) => isAtHome(state, content, v));
    if (someoneIn) lights.push({ id, kind: 'window' });
  }
  return lights;
}
