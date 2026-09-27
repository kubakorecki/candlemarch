# M2: Camp survives a winter

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

A Camp (hero + 5 settlers) on a hand-made map lives through day and night and four seasons. Villagers have names and houses, eat, keep warm in winter, and die of hunger or cold if the player fails. The village can die.

Done when a sensible layout survives its first winter in a headless test and in the owner's playtest, and a bad layout visibly spirals and dies with warnings first.

## Scope

From `docs/spec.md` (Time; Resources; Storage; Villagers; Failure states):

- Clock: 20 ticks/s; one year ≈ 60 min at 1×; day = 3 min (2 day, 1 night); 5 days per season. All Proposed, so every number is content.
- Named villagers with a home and a Job; they go home and sleep at night.
- Gatherers: forager's hut (berries, mushrooms, seasonal), hunter's lodge (meat, hides), fisher's hut (fish; stops when the river freezes).
- Recipes and workshop buffers; firewood from logs at a chopping block (design session 01).
- Stockpiles for all bulk goods; granary for food; eating; spoilage.
- Warmth: every house burns firewood in winter.
- Immigration (free housing + surplus food); death by starvation and freezing; game over when no villagers remain; death-spiral alerts; autosave at dawn.
- Balance harness in `tooling/balance/`.

## Waiting on

- ~~Design session (ticket 01)~~ Done 2026-09-27; rules are in `docs/spec.md`.
- ~~Logistics pick (`m1-roads-logistics/11`)~~ Done: job dispatch (ADR-0001).
