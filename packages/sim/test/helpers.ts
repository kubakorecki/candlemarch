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
