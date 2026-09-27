import { type Content, content } from '@candlemarch/content';
import type { Command } from '../src/commands';
import type { GameState } from '../src/state';
import { step } from '../src/step';

export { content };

/** Runs `ticks` ticks. `commandsAt[t]` is applied on the tick that starts at state.tick === t. */
export function run(
  state: GameState,
  ticks: number,
  commandsAt: Record<number, Command[]> = {},
  c: Content = content,
): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, commandsAt[s.tick] ?? [], c);
  return s;
}

/** Runs until `done(state)` or `maxTicks` more ticks; returns the final state. */
export function runUntil(
  state: GameState,
  done: (s: GameState) => boolean,
  maxTicks: number,
  commandsAt: Record<number, Command[]> = {},
): GameState {
  let s = state;
  for (let i = 0; i < maxTicks && !done(s); i++) s = step(s, commandsAt[s.tick] ?? [], content);
  return s;
}

/** Total units of `resource` anywhere in the world: map objects, buffers, sites and hands. */
export function totalLogs(s: GameState): number {
  let total = 0;
  for (const o of Object.values(s.components.mapObject)) {
    if (content.mapObjects[o.type].resource === 'logs') total += o.amount;
  }
  for (const b of Object.values(s.components.building))
    total += (b.stock.logs ?? 0) + (b.input.logs ?? 0);
  for (const site of Object.values(s.components.site)) total += site.delivered.logs ?? 0;
  for (const v of Object.values(s.components.villager)) total += v.carrying?.amount ?? 0;
  return total;
}

export function woodcuttersHutStock(s: GameState): number {
  const hut = Object.values(s.components.building).find((b) => b.type === 'woodcutters_hut');
  return hut?.stock.logs ?? 0;
}
