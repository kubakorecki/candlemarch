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
  // Three hits kill a Gloamling. Striking first, the Hero beats one for 8 HP and two at once for
  // 28, and three at once (15 hits of 4) knock it out.
  hero: { hp: 55, damage: 9, cooldownTicks: 20, reachTiles: 1, knockoutTicks: 400 },
  // Nine Hero hits clear a Den; it stings back as many times (45 of the Hero's 55 HP).
  den: { hp: 80, damage: 5, cooldownTicks: 20, reachTiles: 1 },
  // 15 Gloamling hits, 300 ticks for one Gloamling alone.
  houseDoorHp: 60,
};
