import type { CombatDef } from './types';

// Night combat. One on one a Gloamling beats a villager (5 hits against 7); packs and the Hero
// change that.
export const combat: CombatDef = {
  gloamling: {
    hp: 20,
    damage: 4,
    cooldownTicks: 20,
    reachTiles: 1,
    walkSpeed: 75, // a villager's walking speed
    sightTiles: 12,
  },
  villager: { hp: 20, damage: 3, cooldownTicks: 20, reachTiles: 1 },
  // Two hits kill a Gloamling; it takes 25 Gloamling hits to knock out.
  hero: { hp: 100, damage: 10, cooldownTicks: 20, reachTiles: 1, knockoutTicks: 400 },
};
