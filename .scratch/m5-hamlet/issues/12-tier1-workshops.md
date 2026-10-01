# Tier-1 master workshops

Status: resolved
Type: task
Blocked by: 09

## What

Content and placeholder art for the master workshops, on the M2 recipe system, all unlocked at Hamlet and idle until their Master (ticket 09):

- Sawpit (Carpenter): logs → planks.
- Stonecutter (Mason): stone → cut stone.
- Brick kiln (Mason): clay + firewood → bricks.
- Smokehouse (Butcher): meat or fish + firewood → smoked meat/fish (long shelf life).

## Done when

- A headless test per chain; content validation covers every reference.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. Sawpit (Carpenter), stonecutter and brick kiln (Mason), smokehouse (Butcher): content, Jobs, resources (planks, cut stone, bricks, smoked fish, smoked meat), Hamlet unlocks, build cards, icons and placeholder art; they run on the recipe system and wait for their Master (ticket 09). Smoked fish and smoked meat are separate Foods; the smokehouse has a recipe for each. Fish and meat come to it from fishers' and hunters' yards only (a Granary isn't a supply). Tests: `packages/sim/test/tier1Workshops.test.ts`. See docs/decisions.md.
