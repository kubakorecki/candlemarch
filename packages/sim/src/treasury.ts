// The Treasury (spec, Economy: Coin): the village's Coin, one total in state (`state.treasury`),
// never stored or hauled. Kept in hundredths of a coin so prices can fall by fractions; whole
// coins everywhere else (content costs, fees, what the HUD shows).
import type { GameState } from './state';

/** Hundredths of a coin in one coin: `state.treasury` counts these. */
export const COIN = 100;

/** Whole coins in the Treasury. */
export function treasuryCoin(state: GameState): number {
  return Math.floor(state.treasury / COIN);
}

/** Whether the Treasury holds at least `coin` whole coins. */
export function canAfford(state: GameState, coin: number): boolean {
  return state.treasury >= coin * COIN;
}

/** Takes `coin` whole coins out of the Treasury. Returns false, taking nothing, if it can't. */
export function spendCoin(state: GameState, coin: number): boolean {
  if (!canAfford(state, coin)) return false;
  state.treasury -= coin * COIN;
  return true;
}
