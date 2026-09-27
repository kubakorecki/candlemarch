# M2 session plan

Created: 2026-09-27

The remaining M2 issues in the order to implement them, one line per session. Every issue's blockers come in an earlier line or earlier in the same line. Issues share a line when they touch the same part of the game and together are one normal session.

```
/implement @.scratch/m2-camp-winter/issues/09-fishers-hut.md and @.scratch/m2-camp-winter/issues/07-stockpiles-all-goods.md and @.scratch/m2-camp-winter/issues/22-construction-by-day.md
/implement @.scratch/m2-camp-winter/issues/23-assign-workers.md
/implement @.scratch/m2-camp-winter/issues/13-houses-and-sleep.md
/implement @.scratch/m2-camp-winter/issues/11-granary-and-eating.md and @.scratch/m2-camp-winter/issues/12-spoilage.md
/implement @.scratch/m2-camp-winter/issues/08-foragers-hut.md
/implement @.scratch/m2-camp-winter/issues/10-hunters-lodge.md
/implement @.scratch/m2-camp-winter/issues/14-warmth.md and @.scratch/m2-camp-winter/issues/15-death.md
/implement @.scratch/m2-camp-winter/issues/16-immigration.md and @.scratch/m2-camp-winter/issues/18-dawn-autosave.md
/implement @.scratch/m2-camp-winter/issues/17-game-over-and-alerts.md
/implement @.scratch/m2-camp-winter/issues/19-bottleneck-readability.md
/implement @.scratch/m2-camp-winter/issues/20-camp-winter-scenario.md
```

Then the owner's playtest, `21-playtest-m2.md`, which closes M2.

## Why this order

1. **09 + 07 + 22.** The fisher's hut adds `fish`, the first Food, so 07 can test that Food is refused by Stockpiles. 09 comes first even though its number is higher; both are unblocked. 22 is a one-rule change (the build timer only runs by day).
2. **23 on its own.** Unassigning and reassigning workers fixes a live problem (a new Workplace can draft the last Carrier). It's easier before Dusk and death add more states to handle.
3. **13 on its own.** Houses, Dusk and Dawn routines, Tired, and the shared slowdown helper that 11 and 14 build on. It's the largest M2 issue.
4. **11 + 12.** Granary, eating and Hungry, then Spoilage on the same Food stores.
5. **08 on its own.** Forage patches with seasonal stock and the shade rule. It comes after 11, so berries and mushrooms go to the Granary instead of piling up.
6. **10 on its own.** Hunting grounds, PRNG hunts and a lot of client work.
7. **14 + 15.** Warmth and Cold, then death by starvation and freezing (15 needs both 11 and 14).
8. **16 + 18.** Both happen at Dawn: a Newcomer arrives, the game autosaves.
9. **17 on its own.** Game over and the alerts, which read everything above.
10. **19 on its own.** Workshop icons, carrier utilization and the road heat-map. It can move earlier at any time (it only needs 06), but it's most useful when the village has several workshops and the M2 playtest is close.
11. **20 on its own.** The camp-winter scenario that proves a sensible layout survives. It needs almost everything above.

Outside M2, the hero playtest (`m1-5-hero-playtest/04`) is the owner's and can happen whenever.
